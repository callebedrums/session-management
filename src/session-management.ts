export const SM_INSTANCES = 'SM-INSTANCES';
export const SM_ID = 'SM-ID';
export const SM_INACTIVE_TIMEOUT_KEY = 'SM-INACTIVE-TIMEOUT';
export const SM_TOKEN_KEY = 'SM-TOKEN';
export const SM_INACTIVE_TIME_LIMIT = 15;

export const SM_EVENTS = {
    SET_SESSION_STORAGE: 'SM-SET-SESSION-STORAGE',
    GET_SESSION_STORAGE: 'SM-GET-SESSION-STORAGE',
    REMOVE_SESSION_STORAGE: 'SM-REMOVE-SESSION-STORAGE',
    TAB_CLOSED: 'SM-TAB-CLOSED'
};

const ACTIVITY_EVENTS = ['mousedown', 'keypress', 'click', 'touchstart', 'scroll'];

const INVALID_SESSION_KEYS = [
    SM_INSTANCES,
    SM_ID,
    SM_INACTIVE_TIMEOUT_KEY,
    SM_TOKEN_KEY,
    SM_INACTIVE_TIME_LIMIT,
    SM_EVENTS.SET_SESSION_STORAGE,
    SM_EVENTS.GET_SESSION_STORAGE,
    SM_EVENTS.REMOVE_SESSION_STORAGE,
    SM_EVENTS.TAB_CLOSED
];

export interface SessionManagementOptions {
    onBecomeMaster?: () => void;
    onSessionTimeout?: () => void;
    onSessionUpdate?: () => void;
    tokenKey?: string;
    inactiveTimeoutKey?: string;
    inactiveTimeLimit?: number;
}

export class SessionManagement {

    private window: Window;
    private sessionStorage: Storage;
    private localStorage: Storage;
    private options: SessionManagementOptions;
    private id: number;

    private timeout: number;
    private storageEventListener: (event: StorageEvent) => void;
    private activityEventListener: () => void;
    private unloadListener: () => void;

    inject(window: Window, options: SessionManagementOptions) {
        // dependencies
        this.window = window;
        this.localStorage = window.localStorage;
        this.sessionStorage = window.sessionStorage;
        this.options = options;
    }

    /**
     * Getter for instances number
     * Returns the total of active instances opened (tabs/windows)
     */
    get instances(): number {
        return parseInt(this.localStorage.getItem(SM_INSTANCES), 10) || 0;
    }

    /**
     * Getter for a master indicator.
     * Returns true if it is the master instance
     * To be the master instance means that it is the earliest instance created.
     * The master instance is the only instance to respond the GET_SESSION_STORAGE event
     * It should be the only instance to manage some kind of resources to avoid conflicts (like managing the token refresh and generation)
     */
    get master(): boolean {
        return this.id === 0;
    }

    /**
     * Getter for slave indicator.
     * Returns true if it is the slave.
     * sm.master != sm.slave is always true
     */
    get slave(): boolean {
        return !this.master;
    }

    /**
     * Getter for the inactive timeout key used to store the inactive timeout in sessionStorage
     * Can be configured by options.inactiveTimeoutKey
     * Default: SM_INACTIVE_TIMEOUT_KEY
     */
    get inactiveTimeoutKey(): string {
        return this.options && this.options.inactiveTimeoutKey || SM_INACTIVE_TIMEOUT_KEY;
    }

    /**
     * Getter for the inactive timeout value
     *
     * Indicates the time in the future when the inactive period expires
     */
    get inactiveTimeLimit() {
        return this.options && this.options.inactiveTimeLimit || SM_INACTIVE_TIME_LIMIT;
    }

    /**
     * Getter for the token key used to store the token value in sessionStorage
     * Can be configured by options.tokenKey
     * Default: SM_TOKEN_KEY
     */
    get tokenKey() {
        return this.options && this.options.tokenKey || SM_TOKEN_KEY;
    }

    /**
     * Setter for token value
     * stores its value in sessionStorage
     */
    set token(token: any) {
        this.sessionStorage.setItem(this.tokenKey, JSON.stringify(token));
        this.triggerSetSessionStorageEvent();
    }

    get token(): any {
        return JSON.parse(this.sessionStorage.getItem(this.tokenKey));
    }

    /**
     * Getter for check if session is started
     * Returns true if it is started
     */
    get isSessionStarted(): boolean {
        return !!this.token && this.checkInactivity(true) || !!this.instances;
    }

    setItem(key: string, value: any) {
        this.validateKey(key);
        this.sessionStorage.setItem(key, value);
        this.triggerSetSessionStorageEvent();
    }

    removeItem(key: string) {
        this.validateKey(key);
        this.sessionStorage.removeItem(key);
        this.triggerRemoveSessionStorageEvent(key);
    }

    getItem(key: string): any {
        return this.sessionStorage.getItem(key);
    }


    start() {
        // undefined >= 0 => false
        if (!(this.id >= 0)) {
            this.id = this.instances;
            this.sessionStorage.setItem(SM_ID, '' + this.id);
            this.localStorage.setItem(SM_INSTANCES, '' + (this.id + 1));

            this.timeout = null;

            this.registerEventsListeners();

            if (this.slave) {
                this.triggerGetSessionStorageEvent();
            }
            if (this.master) {
                this.onBecomeMaster();
            }

            this.refreshInactiveTimeout();
        }

        return this;
    }

    end() {
        this.clearSession(true);
        this.onSessionTimeout();
    }

    checkInactivity(noRefresh = false): boolean {
        const currentTime = new Date();
        const inactiveTimeout = new Date(this.sessionStorage.getItem(this.inactiveTimeoutKey) || null);

        if (inactiveTimeout && currentTime < inactiveTimeout) {
            if (!noRefresh) {
                this.refreshTimeout(inactiveTimeout.getTime() - currentTime.getTime());
            }
            return true;
        }

        if (!noRefresh) {
            this.end();
        }
        return false;
    }

    private refreshInactiveTimeout() {
        const interval = this.inactiveTimeLimit * 60 * 1000;
        const dateTimeout = new Date();
        dateTimeout.setTime(dateTimeout.getTime() + interval);

        this.sessionStorage.setItem(this.inactiveTimeoutKey, `${dateTimeout}`);

        this.refreshTimeout(interval);

        this.triggerSetSessionStorageEvent();
    }

    /**
     * Trigger REMOVE_SESSION_STORAGE event
     * It tells other instances that the sessionStorage had an item hemoved
     */
    private triggerRemoveSessionStorageEvent(key: string) {
        this.localStorage.setItem(SM_EVENTS.REMOVE_SESSION_STORAGE, JSON.stringify({ key }));
        this.localStorage.removeItem(SM_EVENTS.REMOVE_SESSION_STORAGE);
    }

    /**
     * Trigger SET_SESSION_STORAGE event
     * It tells other instances that the sessionStorage was updated and synch all instances with new values
     */
    private triggerSetSessionStorageEvent() {
        this.localStorage.setItem(SM_EVENTS.SET_SESSION_STORAGE, JSON.stringify(this.sessionStorage));
        this.localStorage.removeItem(SM_EVENTS.SET_SESSION_STORAGE);
    }

    /**
     * Trigger GET_SESSION_STORAGE event
     * It tells other instances to answer back with sessionStorage data to synch single instance
     */
    private triggerGetSessionStorageEvent() {
        this.localStorage.setItem(SM_EVENTS.GET_SESSION_STORAGE, `${Date.now()}`);
        this.localStorage.removeItem(SM_EVENTS.GET_SESSION_STORAGE);
    }

    private onBecomeMaster() {
        this.options && this.options.onBecomeMaster && this.options.onBecomeMaster();
    }

    private onSessionTimeout() {
        this.options && this.options.onSessionTimeout && this.options.onSessionTimeout();
    }

    private onSessionUpdate() {
        this.options && this.options.onSessionUpdate && this.options.onSessionUpdate();
    }

    private registerEventsListeners() {
        this.storageEventListener = (event: StorageEvent) => {
            // session storage item was added/updated
            if (event.key === SM_EVENTS.SET_SESSION_STORAGE && event.newValue) {
                const data = JSON.parse(event.newValue);

                for (const key of Object.keys(data)) {
                    key !== SM_ID && this.sessionStorage.setItem(key, data[key]);
                }

                this.onSessionUpdate();
            }

            if (event.key === SM_EVENTS.REMOVE_SESSION_STORAGE && event.newValue) {
                const data = JSON.parse(event.newValue);
                this.sessionStorage.removeItem(data.key);
                this.onSessionUpdate();
            }

            // some tab requiring session storage data
            if (event.key === SM_EVENTS.GET_SESSION_STORAGE && event.newValue) {
                this.master && this.triggerSetSessionStorageEvent();
            }

            // some tab was closed
            if (event.key === SM_EVENTS.TAB_CLOSED && event.newValue) {
                const id = parseInt(event.newValue, 10);
                if (id < this.id) {
                    this.id--;
                    this.sessionStorage.setItem(SM_ID, `${this.id}`);
                    this.master && this.onBecomeMaster();
                }
            }

            if (event.key === null) {
                this.clearSession(false);
                this.onSessionTimeout();
            }
        };
        this.window.addEventListener('storage', this.storageEventListener);

        this.activityEventListener = () => {
            this.isSessionStarted && this.refreshInactiveTimeout();
        };
        ACTIVITY_EVENTS.forEach(eventName => {
            this.window.addEventListener(eventName, this.activityEventListener);
        });

        this.unloadListener = () => {
            if (this.isSessionStarted) {
                this.sessionStorage.removeItem(SM_ID);
                this.localStorage.setItem(SM_EVENTS.TAB_CLOSED, '' + this.id);
                this.localStorage.removeItem(SM_EVENTS.TAB_CLOSED);
                this.localStorage.setItem(SM_INSTANCES, '' + (this.instances - 1));
            }
        };
        this.window.addEventListener('unload', this.unloadListener);
    }

    private unregisterEventListeners() {
        this.window.removeEventListener('storage', this.storageEventListener);

        ACTIVITY_EVENTS.forEach(eventName => {
            this.window.removeEventListener(eventName, this.activityEventListener);
        });

        this.window.removeEventListener('unload', this.unloadListener);
    }

    private clearSession(clearLocalStorage: boolean) {
        this.sessionStorage.clear();
        clearLocalStorage && this.localStorage.clear();
        this.timeout && this.window.clearTimeout(this.timeout);
        this.id = undefined;
        this.unregisterEventListeners();
    }

    private refreshTimeout(interval: number) {
        if (this.timeout) {
            this.window.clearTimeout(this.timeout);
        }
        this.timeout = this.window.setTimeout(() => { this.checkInactivity(); }, interval);
    }

    private validateKey(key: string) {
        if (INVALID_SESSION_KEYS.indexOf(key) >= 0) {
            throw new Error(`invalid key: '${key}' is an invalid key. Session management restrict use.`);
        }
    }
}
