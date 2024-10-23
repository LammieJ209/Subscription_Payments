// Stripe Integration Handler
class StripeIntegration {
    constructor(publishableKey, accountId) {
        this.stripe = Stripe(publishableKey);
        this.accountId = accountId;
    }

    // Create PaymentIntent for upfront payment
    async createPaymentIntent(amount, currency = 'usd', metadata = {}) {
        try {
            const response = await fetch('/api/create-payment-intent', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    amount,
                    currency,
                    metadata,
                    accountId: this.accountId
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to create PaymentIntent');
            }

            const data = await response.json();
            return data.clientSecret;
        } catch (error) {
            console.error('PaymentIntent creation failed:', error);
            throw error;
        }
    }

    // Create Subscription
    async createSubscription(customerId, priceId, paymentMethod, metadata = {}) {
        try {
            const response = await fetch('/api/create-subscription', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    customerId,
                    priceId,
                    paymentMethod,
                    metadata,
                    accountId: this.accountId
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to create subscription');
            }

            return await response.json();
        } catch (error) {
            console.error('Subscription creation failed:', error);
            throw error;
        }
    }

    // Update subscription
    async updateSubscription(subscriptionId, updates) {
        try {
            const response = await fetch(`/api/update-subscription/${subscriptionId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...updates,
                    accountId: this.accountId
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to update subscription');
            }

            return await response.json();
        } catch (error) {
            console.error('Subscription update failed:', error);
            throw error;
        }
    }

    // Cancel subscription
    async cancelSubscription(subscriptionId) {
        try {
            const response = await fetch(`/api/cancel-subscription/${subscriptionId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    accountId: this.accountId
                }),
            });

            if (!response.ok) {
                throw new Error('Failed to cancel subscription');
            }

            return await response.json();
        } catch (error) {
            console.error('Subscription cancellation failed:', error);
            throw error;
        }
    }
}

// Payment Processor
class PaymentProcessor {
    constructor(stripeIntegration) {
        this.stripe = stripeIntegration;
    }

    // Process rental payment with both upfront and recurring components
    async processRentalPayment(paymentDetails) {
        const {
            upfrontAmount,
            recurringAmount,
            interval,
            customerDetails,
            metadata
        } = paymentDetails;

        try {
            // 1. Create or get customer
            const customer = await this.getOrCreateCustomer(customerDetails);

            // 2. Handle upfront payment
            if (upfrontAmount > 0) {
                const paymentIntentSecret = await this.stripe.createPaymentIntent(
                    upfrontAmount,
                    'usd',
                    {
                        ...metadata,
                        payment_type: 'upfront'
                    }
                );

                // Confirm upfront payment (in real implementation, this would be handled by your payment form)
                await this.confirmUpfrontPayment(paymentIntentSecret);
            }

            // 3. Set up recurring subscription
            if (recurringAmount > 0) {
                const subscription = await this.stripe.createSubscription(
                    customer.id,
                    this.getPriceIdForInterval(interval, recurringAmount),
                    customer.default_payment_method,
                    {
                        ...metadata,
                        payment_type: 'recurring'
                    }
                );

                return {
                    success: true,
                    upfrontPaymentId: paymentIntentSecret?.id,
                    subscriptionId: subscription.id
                };
            }

            return {
                success: true,
                upfrontPaymentId: paymentIntentSecret?.id
            };

        } catch (error) {
            console.error('Payment processing failed:', error);
            throw new PaymentProcessingError(error.message);
        }
    }

    // Get or create customer
    async getOrCreateCustomer(customerDetails) {
        // Implementation would interact with your backend
        const response = await fetch('/api/get-or-create-customer', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(customerDetails),
        });

        if (!response.ok) {
            throw new Error('Failed to get or create customer');
        }

        return await response.json();
    }

    // Confirm upfront payment
    async confirmUpfrontPayment(clientSecret) {
        // In a real implementation, this would be handled by your payment form
        // using Stripe Elements or Payment Request Button
        console.log('Confirming upfront payment with client secret:', clientSecret);
    }

    // Get price ID for interval
    getPriceIdForInterval(interval, amount) {
        // In a real implementation, you would have a mapping of intervals to price IDs
        // or create prices dynamically through the Stripe API
        return `price_${interval}_${amount}`;
    }
}

// Webhook Handler
class WebhookHandler {
    constructor() {
        this.handlers = new Map();
        this.setupDefaultHandlers();
    }

    // Set up default webhook handlers
    setupDefaultHandlers() {
        // Payment succeeded
        this.addHandler('payment_intent.succeeded', async (event) => {
            const paymentIntent = event.data.object;
            await this.notifyPaymentSuccess(paymentIntent);
        });

        // Payment failed
        this.addHandler('payment_intent.payment_failed', async (event) => {
            const paymentIntent = event.data.object;
            await this.notifyPaymentFailure(paymentIntent);
        });

        // Subscription renewed
        this.addHandler('invoice.payment_succeeded', async (event) => {
            const invoice = event.data.object;
            if (invoice.subscription) {
                await this.notifySubscriptionRenewal(invoice);
            }
        });

        // Subscription payment failed
        this.addHandler('invoice.payment_failed', async (event) => {
            const invoice = event.data.object;
            await this.notifySubscriptionPaymentFailure(invoice);
        });

        // Subscription canceled
        this.addHandler('customer.subscription.deleted', async (event) => {
            const subscription = event.data.object;
            await this.notifySubscriptionCancellation(subscription);
        });
    }

    // Add custom webhook handler
    addHandler(eventType, handler) {
        this.handlers.set(eventType, handler);
    }

    // Process webhook event
    async handleWebhook(event) {
        const handler = this.handlers.get(event.type);
        if (handler) {
            try {
                await handler(event);
            } catch (error) {
                console.error(`Error handling webhook ${event.type}:`, error);
                throw error;
            }
        }
    }

    // Notification methods
    async notifyPaymentSuccess(paymentIntent) {
        await this.sendNotification({
            type: 'payment_success',
            title: 'Payment Successful',
            message: `Payment of $${paymentIntent.amount / 100} was successful`,
            metadata: paymentIntent.metadata
        });
    }

    async notifyPaymentFailure(paymentIntent) {
        await this.sendNotification({
            type: 'payment_failure',
            title: 'Payment Failed',
            message: `Payment of $${paymentIntent.amount / 100} failed: ${paymentIntent.last_payment_error?.message || 'Unknown error'}`,
            metadata: paymentIntent.metadata
        });
    }

    async notifySubscriptionRenewal(invoice) {
        await this.sendNotification({
            type: 'subscription_renewal',
            title: 'Subscription Renewed',
            message: `Subscription payment of $${invoice.amount_paid / 100} was successful`,
            metadata: invoice.metadata
        });
    }

    async notifySubscriptionPaymentFailure(invoice) {
        await this.sendNotification({
            type: 'subscription_payment_failure',
            title: 'Subscription Payment Failed',
            message: `Subscription payment of $${invoice.amount_due / 100} failed`,
            metadata: invoice.metadata
        });
    }

    async notifySubscriptionCancellation(subscription) {
        await this.sendNotification({
            type: 'subscription_cancelled',
            title: 'Subscription Cancelled',
            message: 'The subscription has been cancelled',
            metadata: subscription.metadata
        });
    }

    // Send notification
    async sendNotification(notification) {
        try {
            const response = await fetch('/api/send-notification', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(notification),
            });

            if (!response.ok) {
                throw new Error('Failed to send notification');
            }

            // Dispatch event for UI updates
            const event = new CustomEvent('payment_notification', {
                detail: notification
            });
            window.dispatchEvent(event);

        } catch (error) {
            console.error('Failed to send notification:', error);
            throw error;
        }
    }
}

// Custom error class
class PaymentProcessingError extends Error {
    constructor(message) {
        super(message);
        this.name = 'PaymentProcessingError';
    }
}

// Export classes
export {
    StripeIntegration,
    PaymentProcessor,
    WebhookHandler,
    PaymentProcessingError
};
