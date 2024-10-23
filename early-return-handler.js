// Update the early return handler to use the new refund processor
import { RefundProcessor } from './refund-processor.js';

class EarlyReturnHandler {
    constructor(stripeIntegration, notificationHandler) {
        this.stripe = stripeIntegration;
        this.refundProcessor = new RefundProcessor(stripeIntegration, notificationHandler);
    }

    // Process early return
    async processEarlyReturn(rentalDetails) {
        try {
            // 1. Validate early return eligibility
            this.validateEarlyReturn(rentalDetails);

            // 2. Calculate credit amount
            const creditAmount = this.calculateCredit(rentalDetails);

            // 3. Generate credit note
            const creditNote = await this.generateCreditNote(rentalDetails, creditAmount);

            // 4. Process refund if applicable
            let refundResult = null;
            if (creditAmount > 0) {
                refundResult = await this.refundProcessor.processEarlyReturnRefund(rentalDetails);
            }

            // 5. Update rental status
            await this.updateRentalStatus(rentalDetails);

            return {
                success: true,
                creditNote,
                creditAmount,
                refund: refundResult,
                message: `Early return processed successfully. ` +
                        `Credit amount: $${creditAmount}` +
                        (refundResult ? `. Refund processed: $${refundResult.amount}` : '')
            };

        } catch (error) {
            console.error('Early return processing failed:', error);
            throw new EarlyReturnError(error.message);
        }
    }

    // Rest of the EarlyReturnHandler class implementation remains the same...
    // (Previous methods from the original file)
}

// Custom error class
class EarlyReturnError extends Error {
    constructor(message) {
        super(message);
        this.name = 'EarlyReturnError';
    }
}

// Export classes
export { EarlyReturnHandler, EarlyReturnError };
