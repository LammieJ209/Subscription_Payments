// Notification Handler
class NotificationHandler {
    constructor() {
        this.notifications = [];
        this.maxNotifications = 100;
        this.setupEventListeners();
    }

    setupEventListeners() {
        window.addEventListener('payment_notification', (event) => {
            this.addNotification(event.detail);
        });
    }

    addNotification(notification) {
        // Add timestamp
        const timestampedNotification = {
            ...notification,
            timestamp: new Date().toISOString()
        };

        // Add to list
        this.notifications.unshift(timestampedNotification);

        // Trim list if needed
        if (this.notifications.length > this.maxNotifications) {
            this.notifications = this.notifications.slice(0, this.maxNotifications);
        }

        // Save to local storage
        this.saveNotifications();

        // Update UI
        this.updateNotificationUI();

        // Show toast
        this.showToast(notification);
    }

    saveNotifications() {
        localStorage.setItem('paymentNotifications', JSON.stringify(this.notifications));
    }

    loadNotifications() {
        const saved = localStorage.getItem('paymentNotifications');
        if (saved) {
            this.notifications = JSON.parse(saved);
            this.updateNotificationUI();
        }
    }

    updateNotificationUI() {
        const container = document.getElementById('notificationList');
        if (!container) return;

        container.innerHTML = this.notifications.map(notification => `
            <div class="notification-item ${notification.type}">
                <div class="notification-header">
                    <h4>${notification.title}</h4>
                    <span class="notification-time">
                        ${this.formatTimestamp(notification.timestamp)}
                    </span>
                </div>
                <p>${notification.message}</p>
                ${this.renderMetadata(notification.metadata)}
            </div>
        `).join('');
    }

    showToast(notification) {
        const toast = document.createElement('div');
        toast.className = `toast ${notification.type}`;
        toast.innerHTML = `
            <div class="toast-header">
                <h4>${notification.title}</h4>
                <button onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
            <p>${notification.message}</p>
        `;

        document.body.appendChild(toast);

        // Remove after 5 seconds
        setTimeout(() => {
            toast.classList.add('fade-out');
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }

    formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleString();
    }

    renderMetadata(metadata) {
        if (!metadata || Object.keys(metadata).length === 0) return '';

        return `
            <div class="notification-metadata">
                ${Object.entries(metadata)
                    .map(([key, value]) => `
                        <div class="metadata-item">
                            <span class="metadata-key">${key}:</span>
                            <span class="metadata-value">${value}</span>
                        </div>
                    `)
                    .join('')}
            </div>
        `;
    }

    clearNotifications() {
        this.notifications = [];
        this.saveNotifications();
        this.updateNotificationUI();
    }
}

// Export class
export { NotificationHandler };
