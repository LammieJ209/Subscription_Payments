// Payment Settings Management
class PaymentSettings {
    constructor() {
        this.settings = this.loadSettings();
        this.templates = this.loadTemplates();
        this.setupEventListeners();
    }

    loadSettings() {
        const defaultSettings = {
            rentalCycle: 5,
            defaultUpfront: 25,
            allowCustomUpfront: true,
            billingFrequencies: {
                weekly: true,
                tenDays: false,
                biweekly: true,
                monthly: true,
                customInterval: null
            },
            fees: {
                delivery: 50,
                collection: 50,
                late: 25
            },
            includeFeesUpfront: true,
            rules: {
                minRentalPeriod: 5,
                maxRentalPeriod: 365,
                requireDeposit: true,
                depositAmount: 200
            },
            paymentMethods: {
                creditCard: true,
                debitCard: true,
                bankTransfer: false
            },
            requireAutoPayment: true
        };

        const savedSettings = localStorage.getItem('paymentSettings');
        return savedSettings ? JSON.parse(savedSettings) : defaultSettings;
    }

    loadTemplates() {
        const savedTemplates = localStorage.getItem('paymentTemplates');
        return savedTemplates ? JSON.parse(savedTemplates) : [];
    }

    setupEventListeners() {
        // Rental Cycle
        document.querySelectorAll('input[name="rentalCycle"]').forEach(radio => {
            radio.addEventListener('change', (e) => {
                this.settings.rentalCycle = parseInt(e.target.value);
            });
        });

        // Upfront Payment
        document.getElementById('defaultUpfront').addEventListener('input', (e) => {
            this.settings.defaultUpfront = parseInt(e.target.value);
        });

        document.getElementById('allowCustomUpfront').addEventListener('change', (e) => {
            this.settings.allowCustomUpfront = e.target.checked;
        });

        // Billing Frequencies
        ['weekly', 'tenDays', 'biweekly', 'monthly'].forEach(frequency => {
            document.getElementById(frequency).addEventListener('change', (e) => {
                this.settings.billingFrequencies[frequency] = e.target.checked;
            });
        });

        document.getElementById('customInterval').addEventListener('input', (e) => {
            this.settings.billingFrequencies.customInterval = e.target.value ? parseInt(e.target.value) : null;
        });

        // Fees
        ['delivery', 'collection', 'late'].forEach(feeType => {
            document.getElementById(`${feeType}Fee`).addEventListener('input', (e) => {
                this.settings.fees[feeType] = parseFloat(e.target.value);
            });
        });

        document.getElementById('includeFeesUpfront').addEventListener('change', (e) => {
            this.settings.includeFeesUpfront = e.target.checked;
        });

        // Rules
        document.getElementById('minRentalPeriod').addEventListener('input', (e) => {
            this.settings.rules.minRentalPeriod = parseInt(e.target.value);
        });

        document.getElementById('maxRentalPeriod').addEventListener('input', (e) => {
            this.settings.rules.maxRentalPeriod = parseInt(e.target.value);
        });

        document.getElementById('requireDeposit').addEventListener('change', (e) => {
            this.settings.rules.requireDeposit = e.target.checked;
            document.getElementById('depositSection').style.display = e.target.checked ? 'block' : 'none';
        });

        document.getElementById('depositAmount').addEventListener('input', (e) => {
            this.settings.rules.depositAmount = parseFloat(e.target.value);
        });

        // Payment Methods
        ['creditCard', 'debitCard', 'bankTransfer'].forEach(method => {
            document.getElementById(method).addEventListener('change', (e) => {
                this.settings.paymentMethods[method] = e.target.checked;
            });
        });

        document.getElementById('requireAutoPayment').addEventListener('change', (e) => {
            this.settings.requireAutoPayment = e.target.checked;
        });
    }

    validateSettings() {
        const errors = [];

        // Validate upfront percentage
        if (this.settings.defaultUpfront < 0 || this.settings.defaultUpfront > 100) {
            errors.push('Default upfront percentage must be between 0 and 100');
        }

        // Validate custom interval
        if (this.settings.billingFrequencies.customInterval !== null) {
            if (this.settings.billingFrequencies.customInterval < 1 || 
                this.settings.billingFrequencies.customInterval > 90) {
                errors.push('Custom billing interval must be between 1 and 90 days');
            }
        }

        // Validate rental periods
        if (this.settings.rules.minRentalPeriod < 1) {
            errors.push('Minimum rental period must be at least 1 day');
        }

        if (this.settings.rules.maxRentalPeriod < this.settings.rules.minRentalPeriod) {
            errors.push('Maximum rental period must be greater than minimum rental period');
        }

        // Validate fees
        for (const [key, value] of Object.entries(this.settings.fees)) {
            if (value < 0) {
                errors.push(`${key.charAt(0).toUpperCase() + key.slice(1)} fee cannot be negative`);
            }
        }

        // Validate deposit amount
        if (this.settings.rules.requireDeposit && this.settings.rules.depositAmount <= 0) {
            errors.push('Deposit amount must be greater than 0');
        }

        return errors;
    }

    saveSettings() {
        const errors = this.validateSettings();
        if (errors.length > 0) {
            this.showMessage(errors.join('\n'), 'error');
            return false;
        }

        try {
            localStorage.setItem('paymentSettings', JSON.stringify(this.settings));
            this.showMessage('Settings saved successfully', 'success');
            return true;
        } catch (error) {
            console.error('Failed to save settings:', error);
            this.showMessage('Failed to save settings', 'error');
            return false;
        }
    }

    showMessage(message, type) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${type}`;
        messageDiv.textContent = message;
        document.body.appendChild(messageDiv);

        setTimeout(() => {
            messageDiv.remove();
        }, 3000);
    }
}

// Template Management
class PaymentTemplate {
    constructor(name, settings) {
        this.id = Date.now();
        this.name = name;
        this.settings = settings;
    }

    static createTemplate(name, settings) {
        return new PaymentTemplate(name, settings);
    }
}

// Initialize settings when page loads
let paymentSettings;
document.addEventListener('DOMContentLoaded', () => {
    paymentSettings = new PaymentSettings();
});

// Save settings
function saveSettings() {
    paymentSettings.saveSettings();
}

// Template management functions
function addTemplate() {
    const name = prompt('Enter template name:');
    if (!name) return;

    const template = PaymentTemplate.createTemplate(name, {...paymentSettings.settings});
    paymentSettings.templates.push(template);
    localStorage.setItem('paymentTemplates', JSON.stringify(paymentSettings.templates));
    renderTemplates();
}

function renderTemplates() {
    const container = document.getElementById('templatesContainer');
    container.innerHTML = '';

    paymentSettings.templates.forEach(template => {
        const templateCard = document.createElement('div');
        templateCard.className = 'template-card';
        templateCard.innerHTML = `
            <h4>${template.name}</h4>
            <div class="template-actions">
                <button onclick="applyTemplate(${template.id})">Apply</button>
                <button onclick="deleteTemplate(${template.id})">Delete</button>
            </div>
            <div class="template-details">
                <p>Rental Cycle: ${template.settings.rentalCycle}-day week</p>
                <p>Default Upfront: ${template.settings.defaultUpfront}%</p>
            </div>
        `;
        container.appendChild(templateCard);
    });
}

function applyTemplate(templateId) {
    const template = paymentSettings.templates.find(t => t.id === templateId);
    if (!template) return;

    paymentSettings.settings = {...template.settings};
    // Update UI with template settings
    updateUIFromSettings();
    paymentSettings.showMessage(`Applied template: ${template.name}`, 'success');
}

function deleteTemplate(templateId) {
    if (!confirm('Are you sure you want to delete this template?')) return;

    paymentSettings.templates = paymentSettings.templates.filter(t => t.id !== templateId);
    localStorage.setItem('paymentTemplates', JSON.stringify(paymentSettings.templates));
    renderTemplates();
    paymentSettings.showMessage('Template deleted', 'success');
}

function updateUIFromSettings() {
    // Update all form inputs to reflect current settings
    const settings = paymentSettings.settings;

    // Rental Cycle
    document.querySelector(`input[name="rentalCycle"][value="${settings.rentalCycle}"]`).checked = true;

    // Upfront Payment
    document.getElementById('defaultUpfront').value = settings.defaultUpfront;
    document.getElementById('allowCustomUpfront').checked = settings.allowCustomUpfront;

    // Billing Frequencies
    for (const [key, value] of Object.entries(settings.billingFrequencies)) {
        if (key !== 'customInterval') {
            document.getElementById(key).checked = value;
        }
    }
    document.getElementById('customInterval').value = settings.billingFrequencies.customInterval || '';

    // Fees
    for (const [key, value] of Object.entries(settings.fees)) {
        document.getElementById(`${key}Fee`).value = value;
    }
    document.getElementById('includeFeesUpfront').checked = settings.includeFeesUpfront;

    // Rules
    document.getElementById('minRentalPeriod').value = settings.rules.minRentalPeriod;
    document.getElementById('maxRentalPeriod').value = settings.rules.maxRentalPeriod;
    document.getElementById('requireDeposit').checked = settings.rules.requireDeposit;
    document.getElementById('depositAmount').value = settings.rules.depositAmount;
    document.getElementById('depositSection').style.display = settings.rules.requireDeposit ? 'block' : 'none';

    // Payment Methods
    for (const [key, value] of Object.entries(settings.paymentMethods)) {
        document.getElementById(key).checked = value;
    }
    document.getElementById('requireAutoPayment').checked = settings.requireAutoPayment;
}
