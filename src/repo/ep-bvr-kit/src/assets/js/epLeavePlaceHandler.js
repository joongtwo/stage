// Copyright (c) 2022 Siemens

/**
 * navigation service for EasyPlan objects.
 *
 * @module js/epLeavePlaceHandler
 */
import leavePlaceService from 'js/leavePlace.service';
import mfgNotificationUtils from 'js/mfgNotificationUtils';
import localeService from 'js/localeService';
import AwPromiseService from 'js/awPromiseService';

let handlersForDirtyCheck = [];

/**
 * register handler for dirty check
 *
 * @param {Object} handler - the handler to register
 */
export function registerHandlerForDirtyCheck( handler ) {
    if( handler ) {
        handlersForDirtyCheck.push( handler );
    }
}

/**
 * Initialization
 */
export function init() {
    // register leave placeholder
    leavePlaceService.registerLeaveHandler( {
        okToLeave: function() {
            let hasChanges = false;
            handlersForDirtyCheck.forEach( handler => {
                if( handler.isDirty() === true ) {
                    hasChanges = true;
                }
            } );
            if( hasChanges ) {
                const localTextBundle = localeService.getLoadedText( 'EPMessages' );
                return mfgNotificationUtils.displayConfirmationMessage( localTextBundle.leaveConfirmation, localTextBundle.save, localTextBundle.discard ).then(
                    () => {
                        //on save
                        let promiseAll = [];
                        handlersForDirtyCheck.forEach( handler => {
                            if( handler.save && handler.isDirty() === true ) {
                                // handler.save();
                                promiseAll.push( handler.save() );
                            }
                        } );
                        return AwPromiseService.instance.all( promiseAll );
                    },
                    () => {
                        // Discarded
                        let promiseAll = [];
                        handlersForDirtyCheck.forEach( handler => {
                            if( handler.discard && handler.isDirty() === true ) {
                                //handler.discard();
                                promiseAll.push( handler.discard() );
                            }
                        } );
                        return AwPromiseService.instance.all( promiseAll );
                    }
                );
            }
            return AwPromiseService.instance.resolve();
        }
    } );
}

/**
 * Destroy
 */
export function destroy() {
    leavePlaceService.registerLeaveHandler( null );
    handlersForDirtyCheck = [];
}

export default {
    registerHandlerForDirtyCheck,
    init,
    destroy
};
