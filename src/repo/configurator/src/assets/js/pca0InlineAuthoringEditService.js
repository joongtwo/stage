// Copyright (c) 2022 Siemens

/**
 * @module js/pca0InlineAuthoringEditService
 */
import awPromiseService from 'js/awPromiseService';
import appCtxSvc from 'js/appCtxService';
import leavePlaceService from 'js/leavePlace.service';
import localeSvc from 'js/localeService';
import notyService from 'js/NotyModule';

import eventBus from 'js/eventBus';
import _ from 'lodash';
import logger from 'js/logger';

/**
 *   Export APIs section starts
 */
let exports = {};
let _callBackObj = null;

/**
 * notifies of the SaveState changed
 * @param {String} stateName - state we are in
 */
let notifySaveStateChanged = function( stateName ) {
    if( self.dataSource ) {
        switch ( stateName ) {
            case 'starting':
                break;
            case 'saved':
                self.dataSource.saveEditiableStates();
                break;
            case 'cancelling':
                self.dataSource.resetEditiableStates();
                break;
            case 'reset':
                self.dataSource.resetEditiableStates();
                break;
            default:
                logger.error( 'Unexpected stateName value: ' + stateName );
        }

        self._editing = stateName === 'starting';
        // Add to the appCtx about the editing state

        appCtxSvc.updateCtx( 'editInProgress', self._editing );

        let context = {
            state: stateName
        };
        context.dataSource = self.dataSource.getSourceObject();
        // Adding name attribute as a workaround for framework defect
        // LCS-683863 - Row edit does not work for inline authoring use cases
        context.dataSource.name = 'treeDataProvider';
        eventBus.publish( 'editHandlerStateChange', context );
    }
};

/**
 * Start editing
 * @param {Object} callBackObj - callBack
 */
export let startEdit = function( callBackObj ) {
    _callBackObj = callBackObj;
    exports.notifySaveStateChanged( 'starting' );
    //Register with leave place service
    leavePlaceService.registerLeaveHandler( {
        okToLeave: function( targetNavDetails, oldState, newState ) {
            var viewModeContext = appCtxSvc.getCtx( 'ViewModeContext' );
            var stillInFeaturesPageTreeView = viewModeContext && viewModeContext.ViewModeContext === 'TreeView' &&
                newState && newState.params && newState.params.pageId === 'tc_xrt_Features';
            if( !stillInFeaturesPageTreeView ) {
                return exports.leaveConfirmation( callBackObj );
            }
            var defer = awPromiseService.instance.defer();
            defer.resolve();
            var self = this;
            setTimeout( function() {
                // Reregister the handler again
                leavePlaceService.registerLeaveHandler( self );
            }, 100 );
            return defer.promise;
        }
    } );
};

/**
 * Can we start editing?
 *
 * @return {Boolean} true if we can start editing
 */
export let canStartEdit = function() {
    return true;
};

/**
 * Is an edit in progress?

 * @return {Boolean} true if we're editing
 */
export let editInProgress = function() {
    return self._editing;
};

/**
 * Get data source
 * @return {Object} data source
 */
export let getDataSource = function() {
    return self.dataSource;
};

/**
 * Set data source
 * @param {Object} newDataSource data source
 */
export let setDataSource = function( newDataSource ) {
    self.dataSource = newDataSource;
};

/**
 * Cancels the edits and cleans up
 */
export let cancelEdits = function() {
    notifySaveStateChanged( 'cancelling' );
    _cleanup();
};

/**
 * Save Edits
 */
export let saveEdits = function() {
    const promise = _callBackObj.saveEdits();
    _cleanup();
    return promise;
};

/**
 * Returns the grid dirty state
 * @return {Boolean} is dirty
 */
export let isDirty = function() {
    let isDirty = false;
    // Based on GRID editable state set the isDirty flag.
    isDirty = exports.editInProgress();
    return isDirty;
};

/**
 * creates a button taking the label and the callback function
 * @param {String} label - label
 * @param {Object} callback - callback
 * @return {Object} button
 */
let createButton = function( label, callback ) {
    return {
        addClass: 'btn btn-notify',
        text: label,
        onClick: callback
    };
};

/**
 * Displays notification message save/cancel edits
 * @returns {Object}  promise Object
 */
let _displayNotificationMessage = function() {
    // If a popup is already active just return existing promise
    if( !self._deferredPopup ) {
        self._deferredPopup = awPromiseService.instance.defer();
        let buttonArray = [];
        let localeTextBundle = localeSvc.getLoadedText( 'ConfiguratorExplorerMessages' );
        let message = localeTextBundle.resetConfirmation;
        buttonArray.push( createButton( localeTextBundle.saveButtonText, function( $noty ) {
            $noty.close();
            exports.saveEdits();
            self._deferredPopup.resolve();
            self._deferredPopup = null;
        } ) );
        buttonArray.push( createButton( localeTextBundle.discard, function( $noty ) {
            $noty.close();
            exports.cancelEdits();
            if( _callBackObj && _callBackObj.cancelEdits ) {
                _callBackObj.cancelEdits();
            }
            self._deferredPopup.resolve();
            self._deferredPopup = null;
        } ) );
        notyService.showWarning( message, buttonArray );
        return self._deferredPopup.promise;
    }
    return self._deferredPopup.promise;
};

/**
 *   This is edit service leaveConfirmation in which call comes for pca0 edit service
 *   if user switches to other tabs while inline authoring is in progress
 *
 *   @param {Object} callback callBack Function
 *   @returns {leaveConfirmation}  promise Object
 */
export const leaveConfirmation = function( callback ) {
    if( exports.isDirty() ) {
        return _displayNotificationMessage().then( function() {
            if( callback && _.isFunction( callback ) ) {
                callback();
            }
        } );
    }
    return awPromiseService.instance.resolve();
};

// clean up handlers.
let _cleanup = function() {
    leavePlaceService.registerLeaveHandler( null );
};

export default exports = {
    notifySaveStateChanged,
    startEdit,
    canStartEdit,
    editInProgress,
    getDataSource,
    setDataSource,
    cancelEdits,
    saveEdits,
    isDirty,
    leaveConfirmation
};
