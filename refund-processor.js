// Refund Processor for Early Returns
class RefundProcessor {
    constructor(stripeIntegration, notificationHandler) {
        this.stripe = stripeIntegration;
        this.notificationHandler = notificationHandler;
    }

    // Process refund for early return
    async processEarlyReturnRefund(rentalDetails) {
        try {
            // 1. Validate refund eligibility
            await this.validateRefundEligibility(rentalDetails);

            // 2. Calculate refund amount
            const refundAmount = await this.calculateRefundAmount(rentalDetails);

            // 3. Process refund through Stripe
            const refund = await this.createStripeRefund(rentalDetails, refundAmount);

            // 4. Update subscription if necessary
            await this.handleSubscriptionUpdate(rentalDetails);

            // 5. Send notifications
            await this.sendRefundNotifications(rentalDetails, refundAmount);

            return {
                success: true,
                refundId: refund.id,
                amount: refundAmount,
                currency: refund.currency
            };

        } catch (error) {
            console.error('Refund processing failed:', error);
            throw new RefundProcessingError(error.message);
        }
    }

    // Validate refund eligibility
    async validateRefundEligibility(rentalDetails) {
        const {
            startDate,
            actualEndDate,
            minHirePeriod,
            paymentIntentId,
            subscriptionId
        } = rentalDetails;

        // Check minimum hire period
        const daysRented = this.calculateDaysRented(startDate, actualEndDate);
        if (daysRented < minHirePeriod) {
            throw new RefundProcessingError(
                `Minimum hire period of ${minHirePeriod} days not met. ` +
                `Current rental duration: ${daysRented} days. No refund will be processed.`
            );
        }

        // Verify payment exists
        if (!paymentIntentId && !subscriptionId) {
            throw new RefundProcessingError('No valid payment found for refund');
        }

        // Check if payment is refundable (not too old)
        if (paymentIntentId) {
            const payment = await this.stripe.paymentIntents.retrieve(paymentIntentId);
            const paymentDate = new Date(payment.created * 1000);
            const now = new Date();
            const daysSincePayment = (now - paymentDate) / (1000 * 60 * 60 * 24);

            if (daysSincePayment > 90) {
                throw new RefundProcessingError('Payment is too old for refund (>90 days)');
            }
        }
    }

    // Calculate refund amount
    async calculateRefundAmount(rentalDetails) {
        const {
            startDate,
            plannedEndDate,
            actualEndDate,
            dailyRate,
            paidAmount,
            subscriptionId,
            fees
        } = rentalDetails;

        // Calculate unused days
        const unusedDays = this.calculateUnusedDays(actualEndDate, plannedEndDate);
        if (unusedDays <= 0) return 0;

        let refundAmount = 0;

        if (subscriptionId) {
            // Handle subscription refund
            const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
            const currentPeriodEnd = new Date(subscription.current_period_end * 1000);
            const currentPeriodStart = new Date(subscription.current_period_start * 1000);
            
            // Only refund remaining days in current period
            const remainingDays = this.calculateUnusedDays(actualEndDate, currentPeriodEnd);
            const periodDays = this.calculateDaysRented(currentPeriodStart, currentPeriodEnd);
            
            refundAmount = (subscription.items.data[0].price.unit_amount / 100) * 
                          (remainingDays / periodDays);
        } else {
            // Handle upfront payment refund
            refundAmount = unusedDays * dailyRate;
        }

        // Adjust for non-refundable fees
        const nonRefundableFees = Object.values(fees)
            .filter(fee => !fee.refundable)
            .reduce((total, fee) => total + fee.amount, 0);

        // Ensure refund doesn't exceed paid amount minus non-refundable fees
        const maxRefund = paidAmount - nonRefundableFees;
        refundAmount = Math.min(refundAmount, maxRefund);

        // Round to 2 decimal places
        return Math.round(refundAmount * 100) / 100;
    }

    // Create refund in Stripe
    async createStripeRefund(rentalDetails, amount) {
        const refundData = {
            payment_intent: rentalDetails.paymentIntentId,
            amount: Math.round(amount * 100), // Convert to cents
            reason: 'requested_by_customer',
            metadata: {
                rental_id: rentalDetails.rentalId,
                customer_id: rentalDetails.customerId,
                reason: 'Early Return',
                planned_end_date: rentalDetails.plannedEndDate,
                actual_end_date: rentalDetails.actualEndDate,
                unused_days: this.calculateUnusedDays(
                    rentalDetails.actualEndDate,
                    rentalDetails.plannedEndDate
                )
            }
        };

        return await this.stripe.refunds.create(refundData);
    }

    // Handle subscription updates
    async handleSubscriptionUpdate(rentalDetails) {
        if (!rentalDetails.subscriptionId) return;

        const subscription = await this.stripe.subscriptions.retrieve(
            rentalDetails.subscriptionId
        );

        // If subscription is still active, cancel it
        if (subscription.status === 'active') {
            await this.stripe.subscriptions.update(rentalDetails.subscriptionId, {
                cancel_at_period_end: true,
                metadata: {
                    cancelled_reason: 'early_return',
                    return_date: rentalDetails.actualEndDate
                }
            });
        }
    }

    // Send notifications about refund
    async sendRefundNotifications(rentalDetails, refundAmount) {
        const unusedDays = this.calculateUnusedDays(
            rentalDetails.actualEndDate,
            rentalDetails.plannedEndDate
        );

        // Notify customer
        await this.notificationHandler.sendNotification({
            type: 'refund_processed',
            title: 'Refund Processed',
            message: `A refund of $${refundAmount} has been processed for your early return. ` +
                    `This covers ${unusedDays} unused rental days. ` +
                    `The refund should appear on your payment method within 5-10 business days.`,
            metadata: {
                rental_id: rentalDetails.rentalId,
                refund_amount: refundAmount,
                unused_days: unusedDays
            }
        });

        // Notify rental company
        await this.notificationHandler.sendNotification({
            type: 'refund_issued',
            title: 'Refund Issued',
            message: `A refund of $${refundAmount} has been issued for rental ${rentalDetails.rentalId}. ` +
                    `Early return processed for ${unusedDays} unused days.`,
            metadata: {
                rental_id: rentalDetails.rentalId,
                customer_id: rentalDetails.customerId,
                refund_amount: refundAmount,
                unused_days: unusedDays
            }
        });
    }

    // Utility methods
    calculateDaysRented(startDate, endDate) {
        return Math.ceil(
            (new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24)
        );
    }

    calculateUnusedDays(actualEndDate, plannedEndDate) {
        const days = Math.ceil(
            (new Date(plannedEndDate) - new Date(actualEndDate)) / (1000 * 60 * 60 * 24)
        );
        return Math.max(0, days);
    }
}

// Custom error class
class RefundProcessingError extends Error {
    constructor(message) {
        super(message);
        this.name = 'RefundProcessingError';
    }
}

// Export classes
export { RefundProcessor, RefundProcessingError };
