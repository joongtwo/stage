// Copyright (c) 2022 Siemens

/**
 * Preferences Edit Handler factory.
 *
 * @module js/adminPreferencesEHFactory
 */
import AwPromiseService from 'js/awPromiseService';
import appCtxSvc from 'js/appCtxService';
import localeSvc from 'js/localeService';
import notySvc from 'js/NotyModule';
import leavePlaceService from 'js/leavePlace.service';
import messagingSvc from 'js/messagingService';
import uwPropertySvc from 'js/uwPropertyService';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import logger from 'js/logger';

var exports = {};

export let createEditHandler = function( dataSource, startEditFunction, saveEditFunc ) {
    // Mark this handler as native
    var editHandler = {
        isNative: true,
        _editing: false,
        _resetPWA: false
    };

    // provided function refs for start/save.
    var _startEditFunction = startEditFunction;
    var _saveEditsFunction = saveEditFunc;

    var _singleLeaveConfirmation = null;
    var _saveTxt = null;
    var _discardTxt = null;
    var _validationError = null;

    if ( localeSvc ) {
        localeSvc.getTextPromise( 'editHandlerMessages' ).then( function( textBundle ) {
            _singleLeaveConfirmation = textBundle.navigationConfirmationSingle;
            _saveTxt = textBundle.save;
            _discardTxt = textBundle.discard;
            _validationError = textBundle.validationError;
        } );
    }

    /**
     * Notify the save state changes
     *
     * @param {String} stateName - edit state name ('starting', 'saved', 'cancelling')
     * @param {Boolean} fireEvents - fire modelObjectsUpdated events
     */
    function _notifySaveStateChanged( stateName ) {
        //dataSource.setSelectionEnabled( stateName !== 'starting' );

        switch ( stateName ) {
            case 'starting':
                //dataSource.setSelectionEnabled( true );
                break;

            case 'saved':
                //dataSource.saveEditiableStates();

                // var loadedVMObjects = dataSource.getLoadedViewModelObjects();
                // _.forEach( loadedVMObjects, function( vmo ) {
                //   vmo.setEditableStates( false, true, true );
                // } );

                //var modifiedPropsArr = dataSource.getAllModifiedProperties();
                var loadedVMObjects = dataSource.getLoadedViewModelObjects();
                var allModifiedProperties = [];
                var targetVMO;
                if ( loadedVMObjects && loadedVMObjects.length > 0 ) {
                    _.forEach( loadedVMObjects, function( vmo ) {
                        if ( 'AAAAAAAAAA' === vmo.uid ) {
                            targetVMO = vmo;
                        }
                    } );
                }

                _.forEach( targetVMO, function( prop ) {
                    if ( uwPropertySvc.isModified( prop ) ) {
                        allModifiedProperties.push( prop );
                    }
                } );
                _.forEach( allModifiedProperties, function( prop ) {
                    uwPropertySvc.resetProperty( prop );
                } );

                // uwPropertySvc.triggerDigestCycle();*/
                break;

            case 'canceling':
                //dataSource.clearEditiableStates( true );
                var loadedVMObjects = dataSource.getLoadedViewModelObjects();
                var allModifiedProperties = [];
                var targetVMO;
                if ( loadedVMObjects && loadedVMObjects.length > 0 ) {
                    _.forEach( loadedVMObjects, function( vmo ) {
                        if ( 'AAAAAAAAAA' === vmo.uid ) {
                            targetVMO = vmo;
                        }
                    } );
                }
                var editEnvVal;
                _.forEach( targetVMO, function( prop ) {
                    if ( uwPropertySvc.isModified( prop ) ) {
                        if( prop.propertyName === 'fnd0EditEnvironment' ) {
                            editEnvVal = uwPropertySvc.getDisplayValues( prop );
                        }
                        allModifiedProperties.push( prop );
                    }
                } );
                var ctxeditInProgress = appCtxSvc.getCtx( 'tcadmconsole.preferences.editInProgress' );
                if( ctxeditInProgress ) {
                    _.forEach( allModifiedProperties, function( prop ) {
                        uwPropertySvc.resetUpdates( prop );
                    } );
                }

                var dispVal = [];
                _.forEach( targetVMO, function( prop ) {
                    if ( prop !== 'AAAAAAAAAA' ) {
                        if ( allModifiedProperties.length === 0 ) {
                            uwPropertySvc.resetUpdates( prop );
                        }
                        if( prop.propertyName === 'fnd0Environment' && editEnvVal !== null ) {
                            if ( editEnvVal ) {
                                dispVal[0] = 'Enabled';
                            } else{
                                dispVal[0] = 'Disabled';
                            }
                            uwPropertySvc.setWidgetDisplayValue( prop, dispVal );
                        }
                        uwPropertySvc.updateViewModelProperty( prop );
                        uwPropertySvc.setIsEditable( prop, false );
                    }
                } );


                //eventBus.publish( 'Preferences.revealPreferenceInfo' );
                //uwPropertySvc.triggerDigestCycle();
                break;

            default:
                logger.error( 'Unexpected stateName value: ' + stateName );
        }

        // Add to the appCtx about the editing state
        editHandler._editing = stateName === 'starting';

        appCtxSvc.updateCtx( 'editInProgress', editHandler._editing );

        var context = {
            state: stateName
        };
        context.dataSource = dataSource.getSourceObject();
        eventBus.publish( 'editHandlerStateChange', context );
    }

    /**
     * Start editing
     *
     * @return {Object} promise
     */
    editHandler.startEdit = function() {
        var defer = AwPromiseService.instance.defer();

        _startEditFunction().then( function( response ) {
            _notifySaveStateChanged( 'starting' );
            defer.resolve( response );
        }, function( err ) {
            defer.reject( err );
        } );

        // Register with leave place service
        leavePlaceService.registerLeaveHandler( {
            okToLeave: function okToLeave() {
                return editHandler.leaveConfirmation();
            }
        } );


        return defer.promise;
    };

    /**
     * Is an edit in progress?
     *
     * @return {Boolean} true if we're editing
     */
    editHandler.editInProgress = function() {
        return this._editing;
    };

    /**
     * Cancel the current edit
     *
     * @param {Boolean} noPendingModifications - are there pending modifications? (optional)
     */
    editHandler.cancelEdits = function( noPendingModifications ) {
        var ctxeditInProgress = appCtxSvc.getCtx( 'tcadmconsole.preferences' );
        let newctxEdit = { ...ctxeditInProgress };
        if( ctxeditInProgress.editInProgress ) {
            newctxEdit.editInProgress = false;
        }
        appCtxSvc.updateCtx( 'tcadmconsole.preferences', newctxEdit );
        leavePlaceService.registerLeaveHandler( null );
        _notifySaveStateChanged( 'canceling', !noPendingModifications );
    };

    /**
     * Perform the actions post Save Edit
     *
     * @param {Boolean} saveSuccess - the save edit was successful
     */
    editHandler.saveEditsPostActions = function( saveSuccess ) {
        if ( saveSuccess ) {
            leavePlaceService.registerLeaveHandler( null );
        }

        _notifySaveStateChanged( 'saved', saveSuccess );
    };

    /**
     * Save the current edits
     *
     * @return {Promise} Promise that is resolved when save edit is complete
     */
    editHandler.saveEdits = function() {
        // Do not save edit if there are validation errors
        var deferred = AwPromiseService.instance.defer();

        dataSource.setSelectionEnabled( true );
        var hasValidationErrors = false;
        var editableViewModelProperties = dataSource.getAllEditableProperties();

        _.forEach( editableViewModelProperties, function( prop ) {
            if ( prop.error && prop.error.length > 0 ) {
                hasValidationErrors = true;
                return false;
            }
        } );

        if ( hasValidationErrors ) {
            //Post error via message service
            messagingSvc.showError( _validationError );

            logger.error( 'Validation Errors' );
            editHandler.cancelEdits();
            deferred.reject( new Error( 'Validation Errors' ) );
        } else {
            // instead of soa call, use provided save function
            _saveEditsFunction().then( function( response ) {
                editHandler.saveEditsPostActions( true );
                if ( editHandler._resetPWA ) {
                    appCtxSvc.updatePartialCtx( 'tcadmconsole.searchCriteria.newPref', undefined );
                    eventBus.publish( 'primaryWorkarea.reset' );
                }
                appCtxSvc.registerCtx( 'tcadmconsole.orgTree.resetPWA', true );
                deferred.resolve( response );
            } );
        }

        return deferred.promise;
    };

    /**
     * Create notify button
     *
     * @param {String} label - label for button
     * @param {Function} callback - callback function on button click
     *
     * @return {Object} button object
     */
    function createButton( label, callback ) {
        return {
            addClass: 'btn btn-notify',
            text: label,
            onClick: callback
        };
    }

    editHandler.getDataSource = function() {
        return dataSource;
    };

    /**
     * Check for dirty edits.
     *
     * @return {boolean} value based on viewModel has some unsaved edits
     */
    editHandler.isDirty = function() {
        var self = this;
        var isDirty = false;
        if ( self.editInProgress() ) {
            //var modifiedViewModelProperties = dataSource.getAllModifiedProperties();
            var loadedVMObjects = dataSource.getLoadedViewModelObjects();
            var allModifiedProperties = [];
            var targetVMO;
            if ( loadedVMObjects && loadedVMObjects.length > 0 ) {
                _.forEach( loadedVMObjects, function( vmo ) {
                    if ( 'AAAAAAAAAA' === vmo.uid ) {
                        targetVMO = vmo;
                    }
                } );
            }

            _.forEach( targetVMO, function( prop ) {
                if ( uwPropertySvc.isModified( prop ) ) {
                    allModifiedProperties.push( prop );
                }
            } );
            if ( allModifiedProperties && allModifiedProperties.length > 0 ) {
                isDirty = true;
            }
        }
        return isDirty;
    };

    /**
     * Display a notification message. Prevents duplicate popups from being active at the same time.
     *
     * @return {Promise} A promise resolved when option in popup is selected
     */

    var displayNotyMessage = function displayNotyMessage() {
        // If a popup is already active just return existing promise
        if ( !editHandler._deferredPopup ) {
            editHandler._deferredPopup = AwPromiseService.instance.defer();

            var modifiedObject = dataSource.getSourceObject().vmo;
            var message = _singleLeaveConfirmation.replace( '{0}', modifiedObject.props.fnd0PreferenceName.uiValue );

            var buttonArray = [];
            buttonArray.push( createButton( _saveTxt, function( $noty ) {
                $noty.close();
                editHandler.saveEdits().then( function() {
                    editHandler._deferredPopup.resolve();
                    editHandler._deferredPopup = null;
                }, function() {
                    editHandler._deferredPopup.resolve();
                    editHandler._deferredPopup = null;
                } );
            } ) );
            buttonArray.push( createButton( _discardTxt, function( $noty ) {
                $noty.close();
                editHandler.cancelEdits();
                editHandler._deferredPopup.resolve();
                editHandler._deferredPopup = null;
            } ) );

            notySvc.showWarning( message, buttonArray );
            return editHandler._deferredPopup.promise;
        }

        return editHandler._deferredPopup.promise;
    };

    /**
     *
     * Leave confirmation. If passed a callback will call the callback once it is ok to leave. Returns a promise
     * that is resolved when it is ok to leave.
     *
     * @param {Object} callback - async callback
     *
     * @return {Object} promise
     */
    editHandler.leaveConfirmation = function( callback ) {
        var self = this;
        if ( self.isDirty() ) {
            return displayNotyMessage().then( function() {
                if ( _.isFunction( callback ) ) {
                    callback();
                }
            } );
        }

        editHandler.cancelEdits( true );
        if ( _.isFunction( callback ) ) {
            callback();
        }
        return AwPromiseService.instance.resolve();
    };

    editHandler.canEditSubLocationObjects = function() {
        return true;
    };

    editHandler.getSelection = function() {
        return undefined;
    };

    editHandler.destroy = function() {
        dataSource = null;
    };

    editHandler.setResetPWA = function( resetPWA ) {
        editHandler._resetPWA = resetPWA;
    };

    return editHandler;
};

export default exports = {
    createEditHandler
};
