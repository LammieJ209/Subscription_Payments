// Off-Hire Process Handler
class OffHireProcessor {
    constructor(earlyReturnHandler) {
        this.earlyReturnHandler = earlyReturnHandler;
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Process off-hire form submission
        document.getElementById('offHireForm')?.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.processOffHire(e.target);
        });

        // Update credit preview when return date changes
        document.getElementById('actualEndDate')?.addEventListener('change', (e) => {
            this.updateCreditPreview(e.target.value);
        });
    }

    // Process off-hire submission
    async processOffHire(form) {
        try {
            this.showLoading(true);

            const rentalDetails = {
                rentalId: form.rentalId.value,
                customerId: form.customerId.value,
                startDate: form.startDate.value,
                plannedEndDate: form.plannedEndDate.value,
                actualEndDate: form.actualEndDate.value,
                dailyRate: parseFloat(form.dailyRate.value),
                paidAmount: parseFloat(form.paidAmount.value),
                minHirePeriod: parseInt(form.minHirePeriod.value),
                paymentIntentId: form.paymentIntentId.value,
                subscriptionId: form.subscriptionId.value,
                fees: {
                    delivery: {
                        amount: parseFloat(form.deliveryFee.value),
                        refundable: false
                    },
                    collection: {
                        amount: parseFloat(form.collectionFee.value),
                        refundable: false
                    }
                }
            };

            const result = await this.earlyReturnHandler.processEarlyReturn(rentalDetails);
            
            this.showSuccess(result);
            this.updateUI(result);

        } catch (error) {
            this.showError(error);
        } finally {
            this.showLoading(false);
        }
    }

    // Update credit preview
    async updateCreditPreview(actualEndDate) {
        try {
            const form = document.getElementById('offHireForm');
            if (!form) return;

            const rentalDetails = {
                startDate: form.startDate.value,
                plannedEndDate: form.plannedEndDate.value,
                actualEndDate: actualEndDate,
                dailyRate: parseFloat(form.dailyRate.value),
                paidAmount: parseFloat(form.paidAmount.value),
                fees: {
                    delivery: {
                        amount: parseFloat(form.deliveryFee.value),
                        refundable: false
                    },
                    collection: {
                        amount: parseFloat(form.collectionFee.value),
                        refundable: false
                    }
                }
            };

            const creditAmount = this.earlyReturnHandler.calculateCredit(rentalDetails);
            this.updateCreditPreviewUI(creditAmount);

        } catch (error) {
            console.error('Failed to update credit preview:', error);
        }
    }

    // UI Updates
    updateCreditPreviewUI(creditAmount) {
        const previewElement = document.getElementById('creditPreview');
        if (previewElement) {
            previewElement.textContent = `Estimated Credit: $${creditAmount.toFixed(2)}`;
            previewElement.style.display = creditAmount > 0 ? 'block' : 'none';
        }
    }

    updateUI(result) {
        // Update rental status
        const statusElement = document.getElementById('rentalStatus');
        if (statusElement) {
            statusElement.textContent = 'Returned';
            statusElement.className = 'status-returned';
        }

        // Show credit note details
        const creditNoteElement = document.getElementById('creditNoteDetails');
        if (creditNoteElement && result.creditNote) {
            creditNoteElement.innerHTML = `
                <h3>Credit Note Generated</h3>
                <p>Amount: $${result.creditAmount.toFixed(2)}</p>
                <p>Reference: ${result.creditNote.id}</p>
                <p>Date: ${new Date().toLocaleDateString()}</p>
            `;
            creditNoteElement.style.display = 'block';
        }

        // Disable form
        const form = document.getElementById('offHireForm');
        if (form) {
            form.querySelectorAll('input, button').forEach(element => {
                element.disabled = true;
            });
        }
    }

    showLoading(show) {
        const button = document.querySelector('#offHireForm button[type="submit"]');
        if (button) {
            button.disabled = show;
            button.innerHTML = show ? 'Processing...' : 'Process Off-Hire';
        }
    }

    showSuccess(result) {
        const messageElement = document.createElement('div');
        messageElement.className = 'success-message';
        messageElement.textContent = result.message;
        this.showMessage(messageElement);
    }

    showError(error) {
        const messageElement = document.createElement('div');
        messageElement.className = 'error-message';
        messageElement.textContent = error.message;
        this.showMessage(messageElement);
    }

    showMessage(messageElement) {
        const container = document.querySelector('.message-container');
        if (container) {
            container.innerHTML = '';
            container.appendChild(messageElement);
            setTimeout(() => {
                messageElement.remove();
            }, 5000);
        }
    }
}

// Export class
export { OffHireProcessor };
