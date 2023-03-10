// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * Utilities to show notification (confirmation) messages
 *
 * @module js/mfgNotificationUtils
 */
'use strict';

import messagingService from 'js/messagingService';
import AwPromiseService from 'js/awPromiseService';
import localeSvc from 'js/localeService';

/**
 * Display confirmation message
 * @param {String} message the message text
 * @param {String} confirmButtonName the text to display for the confirm button
 * @param {String} cancelButtonName the text to display for the cancel button
 * @returns {Promise} promise
 */
export function displayConfirmationMessage( message, confirmButtonName, cancelButtonName ) {
    let deferred = AwPromiseService.instance.defer();
    let buttonArray = [];
    if ( cancelButtonName ) {
        buttonArray.push(
            createButton( cancelButtonName, function( $noty ) {
                $noty.close();
                deferred.reject();
                deferred = null;
            } )
        );
    }
    if ( confirmButtonName ) {
        buttonArray.push(
            createButton( confirmButtonName, function( $noty ) {
                $noty.close();
                deferred.resolve();
                deferred = null;
            } )
        );
    }

    messagingService.showWarning( message, buttonArray );
    return deferred.promise;
}

/**
 * Create button for use in notification messages
 *
 * @param {String} label label
 * @param {Function} callback callback
 * @return {Object} button
 */
export function createButton( label, callback ) {
    return {
        addClass: 'btn btn-notify',
        text: label,
        onClick: callback
    };
}

/**
 *
 * @param {string} label - the button label
 * @returns {object} a button which when clicked upon closes the message
 */
export function createButtonWhichClosesNotyMsg( label ) {
    return createButton( label, ( $noty ) => $noty.close() );
}

/**
 *
 * @param {string} message - the warning message
 * @param {string[]} buttonLabels - the buttons label
 * @return {promise<string>} a promise which is resolved to a string which is the text of the clicked button
 */
export function displayConfirmationMsgWithNumerousButtons( message, buttonLabels ) {
    const deferred = AwPromiseService.instance.defer();
    const buttonArray = buttonLabels.map( ( label ) => {
        return createButton( label, ( noty ) => {
            noty.close();
            deferred.resolve( label );
        } );
    } );
    messagingService.showWarning( message, buttonArray );
    return deferred.promise;
}

/**
 * Display an error message that the user cannot edit in read only mode
 */
export function displayNoEditingInReadOnlyModeError() {
    localeSvc.getTextPromise( 'mfeUtilsMessages' ).then(
        ( { noEditingInReadOnlyMode, close } ) => {
            messagingService.showError( noEditingInReadOnlyMode, null, null, [ createButtonWhichClosesNotyMsg( close ) ] );
        }
    );
}

export default {
    displayConfirmationMessage,
    createButton,
    displayConfirmationMsgWithNumerousButtons,
    displayNoEditingInReadOnlyModeError,
    createButtonWhichClosesNotyMsg
};
