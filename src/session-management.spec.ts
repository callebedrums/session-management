
import {
    SessionManagement,
    SessionManagementOptions,
    SM_INSTANCES,
    SM_INACTIVE_TIMEOUT_KEY,
    SM_INACTIVE_TIME_LIMIT,
    SM_TOKEN_KEY,
    SM_EVENTS,
    SM_ID
} from './session-management';

import { expect, use } from 'chai';
import SinonChai from 'sinon-chai';
import chaiAsPromised from 'chai-as-promised';
import Sinon, { SinonStub } from 'sinon';

use(SinonChai);
use(chaiAsPromised);

describe('SessionService', () => {

    let session: SessionManagement;
    let options: SessionManagementOptions;
    let window: any;

    beforeEach(() => {
        session = new SessionManagement();
    });

    it('should be created', () => {
        expect(session).to.not.be.undefined;
    });

    describe('instance', () => {

        beforeEach(() => {

            options = {
                onBecomeMaster: Sinon.stub(),
                onSessionTimeout: Sinon.stub(),
                onSessionUpdate: Sinon.stub()
            };

            window = {
                sessionStorage: {
                    setItem: Sinon.stub(),
                    getItem: Sinon.stub(),
                    removeItem: Sinon.stub(),
                    clear: Sinon.stub(),
                },
                localStorage: {
                    setItem: Sinon.stub(),
                    getItem: Sinon.stub(),
                    removeItem: Sinon.stub(),
                    clear: Sinon.stub(),
                },
                setTimeout: Sinon.stub(),
                clearTimeout: Sinon.stub(),
                addEventListener: Sinon.stub(),
                removeEventListener: Sinon.stub()
            };

            session.inject(window, options);
        });

        it('should return number of SessionManagement instances (number of open tabs/windows)', () => {
            (window.localStorage.getItem as SinonStub).returns(3);
            expect(session.instances).to.be.equal(3);
            expect(window.localStorage.getItem).to.have.been.calledOnceWith(SM_INSTANCES);
        });

        it('should check if it is the master instance by check if instance id is zero', () => {
            expect(session.master).to.be.equal(false);
        });

        it('should check if it is slave instance by checking if it is not master instance', () => {
            expect(session.slave).to.be.equal(true);
        });

        it('should get the default inactive timeout session key', () => {
            expect(session.inactiveTimeoutKey).to.be.equal(SM_INACTIVE_TIMEOUT_KEY);
        });

        it('should get the default inactive timeout limit time', () => {
            expect(session.inactiveTimeLimit).to.be.equal(SM_INACTIVE_TIME_LIMIT);
        });

        it('should get the default token session key', () => {
            expect(session.tokenKey).to.be.equal(SM_TOKEN_KEY);
        });

        it('should store token on sessionStorage and trigger update event on localStorage', () => {
            session.token = { Token: 'token' };

            expect(window.sessionStorage.setItem).to.have.been.calledOnceWith(SM_TOKEN_KEY, JSON.stringify({ Token: 'token' }));
            expect(window.localStorage.setItem).to.have.been.calledOnceWith(SM_EVENTS.SET_SESSION_STORAGE, JSON.stringify(window.sessionStorage));
            expect(window.localStorage.removeItem).to.have.been.calledOnceWith(SM_EVENTS.SET_SESSION_STORAGE);
        });

        it('should read token from sessionStorage', () => {
            (window.sessionStorage.getItem as SinonStub).returns(JSON.stringify({ Token: 'token' }));

            expect(session.token).to.eql({ Token: 'token' });
            expect(window.sessionStorage.getItem).to.have.been.calledOnceWith(SM_TOKEN_KEY);
        });

        it('should check inactivity and return true if user is active', () => {
            const date = new Date();
            date.setTime(date.getTime() + 1000);

            expect(session.checkInactivity(true)).to.be.equal(false);
            expect(window.sessionStorage.getItem).to.have.been.calledOnceWith(SM_INACTIVE_TIMEOUT_KEY);

            ((window.sessionStorage.getItem) as SinonStub).returns(date);
            expect(session.checkInactivity(true)).to.be.equal(true);
            expect(window.sessionStorage.getItem).to.have.been.calledTwice;
            expect(window.sessionStorage.getItem).to.have.been.calledWith(SM_INACTIVE_TIMEOUT_KEY);
        });

        it('should check if session is started', () => {
            const date = new Date();
            date.setTime(date.getTime() + 1000);
            ((window.localStorage.getItem) as SinonStub).returns(0);
            ((window.sessionStorage.getItem) as SinonStub).returns('null');

            expect(session.isSessionStarted).to.be.equal(false);

            ((window.localStorage.getItem) as SinonStub).returns(1);

            expect(session.isSessionStarted).to.be.equal(true);

            ((window.localStorage.getItem) as SinonStub).returns(0);
            ((window.sessionStorage.getItem) as SinonStub).withArgs(SM_TOKEN_KEY).returns('{"Token":"token"}');
            ((window.sessionStorage.getItem) as SinonStub).withArgs(SM_INACTIVE_TIMEOUT_KEY).returns(null);

            expect(session.isSessionStarted).to.be.equal(false);

            ((window.localStorage.getItem) as SinonStub).returns(0);
            ((window.sessionStorage.getItem) as SinonStub).withArgs(SM_TOKEN_KEY).returns('{"Token":"token"}');
            ((window.sessionStorage.getItem) as SinonStub).withArgs(SM_INACTIVE_TIMEOUT_KEY).returns(date);

            expect(session.isSessionStarted).to.be.equal(true);
        });

        it('should set item in the session', () => {
            session.setItem('my-key', 123);

            expect(window.sessionStorage.setItem).to.have.been.calledOnceWith('my-key', 123);
            expect(window.localStorage.setItem).to.have.been.calledOnceWith(SM_EVENTS.SET_SESSION_STORAGE, JSON.stringify(window.sessionStorage));
            expect(window.localStorage.removeItem).to.have.been.calledOnceWith(SM_EVENTS.SET_SESSION_STORAGE);
        });

        it('should throw an error if key is invalid when seting an item', () => {
            expect(() => { session.setItem(SM_TOKEN_KEY, 123); }).to.throw(Error, `invalid key: '${SM_TOKEN_KEY}' is an invalid key. Session management restrict use.`);
        });

        it('should remove item from the session', () => {
            session.removeItem('my-key');

            expect(window.sessionStorage.removeItem).to.have.been.calledOnceWith('my-key');
            expect(window.localStorage.setItem).to.have.been.calledOnceWith(SM_EVENTS.REMOVE_SESSION_STORAGE, JSON.stringify({ key: 'my-key' }));
            expect(window.localStorage.removeItem).to.have.been.calledOnceWith(SM_EVENTS.REMOVE_SESSION_STORAGE);
        });

        it('should throw an error if key is invalid when removing an item', () => {
            expect(() => { session.removeItem(SM_TOKEN_KEY); }).to.throw(Error, `invalid key: '${SM_TOKEN_KEY}' is an invalid key. Session management restrict use.`);
        });

        it('should get item from the session', () => {
            ((window.sessionStorage.getItem) as SinonStub).returns(123);

            expect(session.getItem('my-key')).to.be.equal(123);
            expect(window.sessionStorage.getItem).to.have.been.calledOnceWith('my-key');
        });

        describe('start session', () => {

            let storageHandler: (event: StorageEvent) => any;
            let unloadHandler: () => any;
            let activityHandler: () => any;
            let timeoutHandler: () => any;
            let timeoutReference = 0;

            beforeEach(() => {

                (window.setTimeout as SinonStub).callsFake((cb: () => any) => {
                    timeoutHandler = cb;
                    return timeoutReference;
                });

                const stub: SinonStub = window.addEventListener;

                stub.withArgs('storage', Sinon.match.func).callsFake((event: string, cb: (event: StorageEvent) => any) => {
                    storageHandler = cb;
                });

                stub.withArgs('unload', Sinon.match.func).callsFake((event: string, cb: () => any) => {
                    unloadHandler = cb;
                });

                stub.callsFake((event: string, cb: () => any) => {
                    activityHandler = cb;
                });
            });

            it('should start the session as master', () => {
                (window.localStorage.getItem as SinonStub).returns(0);

                session.start();

                expect(window.localStorage.getItem).to.have.been.calledWith(SM_INSTANCES);
                expect(window.sessionStorage.setItem).to.have.been.calledWith(SM_ID, '0');
                expect(window.localStorage.setItem).to.have.been.calledWith(SM_INSTANCES, '1');

                expect(window.addEventListener).to.have.been.calledWith('storage', Sinon.match.func);
                expect(window.addEventListener).to.have.been.calledWith('unload', Sinon.match.func);
                expect((window.addEventListener as SinonStub).callCount).to.be.equal(7);
                expect(storageHandler).to.be.instanceof(Function);
                expect(unloadHandler).to.be.instanceof(Function);
                expect(activityHandler).to.be.instanceof(Function);

                expect(options.onBecomeMaster).to.have.been.calledOnce;

                const interval = SM_INACTIVE_TIME_LIMIT * 60 * 1000;
                const dateTimeout = new Date();
                dateTimeout.setTime(dateTimeout.getTime() + interval);

                expect(window.sessionStorage.setItem).to.have.been.calledWith(SM_INACTIVE_TIMEOUT_KEY, `${dateTimeout}`);
                expect(window.setTimeout).to.have.been.calledWith(Sinon.match.func, interval);
                expect(timeoutHandler).to.be.instanceof(Function);

                expect(window.localStorage.setItem).to.have.been.calledWith(SM_EVENTS.SET_SESSION_STORAGE, JSON.stringify(window.sessionStorage));
                expect(window.localStorage.removeItem).to.have.been.calledWith(SM_EVENTS.SET_SESSION_STORAGE);

                expect(session.start()).to.be.equal(session);
            });

            it('should start the session as slave', () => {
                ((window.localStorage.getItem) as any).returns(1);

                session.start();

                expect(window.localStorage.setItem).to.have.been.calledWith(SM_EVENTS.GET_SESSION_STORAGE, Sinon.match.string);
                expect(window.localStorage.removeItem).to.have.been.calledWith(SM_EVENTS.GET_SESSION_STORAGE);

                expect(options.onBecomeMaster).to.not.have.been.called;
            });

            describe('event handler and setTimeout tests as master', () => {
                beforeEach(() => {
                    (window.localStorage.getItem as SinonStub).returns(0);
                    timeoutReference = 1;

                    session.start();
                });

                it('should update session data when SM_EVENTS.SET_SESSION_STORAGE event is triggered', () => {
                    const newValue: any = {};
                    const event = {
                        key: SM_EVENTS.SET_SESSION_STORAGE,
                        newValue
                    };
                    newValue[SM_ID] = 2;
                    newValue['my-key'] = 123;
                    event.newValue = JSON.stringify(newValue);

                    storageHandler(event as StorageEvent);

                    expect(window.sessionStorage.setItem).to.have.been.calledWith('my-key', 123);
                    expect(options.onSessionUpdate).to.have.been.called;
                });

                it('should remve data from session when SM_EVENTS.REMOVE_SESSION_STORAGE event is triggered', () => {
                    const event = {
                        key: SM_EVENTS.REMOVE_SESSION_STORAGE,
                        newValue: JSON.stringify({ key: 'my-key' })
                    };

                    storageHandler(event as StorageEvent);

                    expect(window.sessionStorage.removeItem).to.have.been.calledWith('my-key');
                    expect(options.onSessionUpdate).to.have.been.called;
                });

                it('should answer back with a SM_EVENTS.SET_SESSION_STORAGE when a SM_EVENTS.GET_SESSION_STORAGE is triggered and instance is master', () => {
                    const event = {
                        key: SM_EVENTS.GET_SESSION_STORAGE,
                        newValue: 'new-value'
                    };

                    storageHandler(event as StorageEvent);

                    expect(window.localStorage.setItem).to.have.been.calledWith(SM_EVENTS.SET_SESSION_STORAGE, JSON.stringify(window.sessionStorage));
                    expect(window.localStorage.removeItem).to.have.been.calledWith(SM_EVENTS.SET_SESSION_STORAGE);
                });

                it('should clear the session and remove the listener when other tabs session clears it', () => {
                    const event: any = {
                        key: null
                    };

                    storageHandler(event as StorageEvent);

                    expect(window.sessionStorage.clear).to.have.been.called;
                    expect(window.localStorage.clear).not.to.have.been.called;
                    expect(window.clearTimeout).to.have.been.calledWith(timeoutReference);
                    expect(window.removeEventListener).to.have.been.calledWith('storage', Sinon.match.func);
                    expect(window.removeEventListener).to.have.been.calledWith('unload', Sinon.match.func);
                    expect(window.removeEventListener.callCount).to.be.equal(7);

                    expect(options.onSessionTimeout).to.have.been.called;
                });

                it('should refresh inactivite timeout when user interacts with the system', () => {
                    const date = new Date();
                    date.setTime(date.getTime() + 1000);
                    (window.sessionStorage.getItem as SinonStub).withArgs(SM_INACTIVE_TIMEOUT_KEY).returns(date);
                    (window.sessionStorage.getItem as SinonStub).withArgs(SM_TOKEN_KEY).returns(JSON.stringify({ Token: 'token' }));

                    activityHandler();

                    const interval = SM_INACTIVE_TIME_LIMIT * 60 * 1000;
                    const dateTimeout = new Date();
                    dateTimeout.setTime(dateTimeout.getTime() + interval);

                    expect(window.sessionStorage.setItem).to.have.been.calledWith(SM_INACTIVE_TIMEOUT_KEY, `${dateTimeout}`);
                    expect(window.setTimeout).to.have.been.calledWith(Sinon.match.func, interval);

                });

                it('should trigger the SM_EVENTS.TAB_CLOSED when the tab/window is closed', () => {
                    const date = new Date();
                    date.setTime(date.getTime() + 1000);
                    (window.sessionStorage.getItem as SinonStub).withArgs(SM_INACTIVE_TIMEOUT_KEY).returns(date);
                    (window.sessionStorage.getItem as SinonStub).withArgs(SM_TOKEN_KEY).returns(JSON.stringify({ Token: 'token' }));
                    (window.localStorage.getItem as SinonStub).withArgs(SM_INSTANCES).returns('1');

                    unloadHandler();

                    expect(window.sessionStorage.removeItem).to.have.been.calledWith(SM_ID);
                    expect(window.localStorage.setItem).to.have.been.calledWith(SM_EVENTS.TAB_CLOSED, '0');
                    expect(window.localStorage.removeItem).to.have.been.calledWith(SM_EVENTS.TAB_CLOSED);
                    expect(window.localStorage.setItem).to.have.been.calledWith(SM_INSTANCES, '0');
                });

                it('should not trigger SM_EVENTS.TAB_CLOSED if session is not started', () => {
                    (window.sessionStorage.getItem as SinonStub).withArgs(SM_TOKEN_KEY).returns(JSON.stringify(null));
                    (window.localStorage.getItem as SinonStub).withArgs(SM_INSTANCES).returns('0');

                    unloadHandler();

                    expect(window.sessionStorage.removeItem).not.to.have.been.calledWith(SM_ID);
                    expect(window.localStorage.setItem).not.to.have.been.calledWith(SM_EVENTS.TAB_CLOSED, '0');
                    expect(window.localStorage.removeItem).not.to.have.been.calledWith(SM_EVENTS.TAB_CLOSED);
                    expect(window.localStorage.setItem).not.to.have.been.calledWith(SM_INSTANCES, '0');
                });

                describe('refresh timeout', () => {

                    it('should refresh timeout if user is active', () => {
                        const date = new Date();
                        date.setTime(date.getTime() + 1000);
                        (window.sessionStorage.getItem as SinonStub).withArgs(SM_INACTIVE_TIMEOUT_KEY).returns(date);

                        timeoutHandler();

                        expect(window.sessionStorage.getItem).to.have.been.calledWith(SM_INACTIVE_TIMEOUT_KEY);
                        expect(window.clearTimeout).to.have.been.calledWith(timeoutReference);
                        expect(window.setTimeout).to.have.been.calledWith(Sinon.match.func, Sinon.match.number);
                    });

                    it('should end session if user is inactive', () => {
                        const date = new Date();
                        date.setTime(date.getTime() - 1000);
                        (window.sessionStorage.getItem as SinonStub).withArgs(SM_INACTIVE_TIMEOUT_KEY).returns(date);

                        timeoutHandler();

                        expect(window.sessionStorage.getItem).to.have.been.calledWith(SM_INACTIVE_TIMEOUT_KEY);
                        expect(window.sessionStorage.clear).to.have.been.called;
                        expect(window.localStorage.clear).to.have.been.called;
                        expect(window.clearTimeout).to.have.been.calledWith(timeoutReference);
                        expect(window.removeEventListener).to.have.been.calledWith('storage', Sinon.match.func);
                        expect(window.removeEventListener).to.have.been.calledWith('unload', Sinon.match.func);
                        expect(window.removeEventListener.callCount).to.be.equal(7);

                        expect(options.onSessionTimeout).to.have.been.called;
                    });
                });
            });

            describe('event handler and setTimeout tests as slave', () => {
                beforeEach(() => {
                    (window.localStorage.getItem as SinonStub).returns(1);
                    timeoutReference = 1;

                    session.start();
                });

                it('should decrease its ID and became master when master tab closes', () => {
                    const event = {
                        key: SM_EVENTS.TAB_CLOSED,
                        newValue: '0'
                    };

                    storageHandler(event as StorageEvent);

                    expect(window.sessionStorage.setItem).to.have.been.calledWith(SM_ID, '0');
                    expect(options.onBecomeMaster).to.have.been.called;
                });

                it('should not decrease its ID when higher tab closes', () => {
                    const event = {
                        key: SM_EVENTS.TAB_CLOSED,
                        newValue: '2'
                    };

                    storageHandler(event as StorageEvent);

                    expect(window.sessionStorage.setItem).not.to.have.been.calledWith(SM_ID, '0');
                    expect(options.onBecomeMaster).not.to.have.been.called;
                });
            });
        });
    });
});
