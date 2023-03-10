// Copyright (c) 2022 Siemens

/**
 * @module js/MrmOccmgmtGetOccsResponseService
 */
import cdm from 'soa/kernel/clientDataModel';
import appCtxService from 'js/appCtxService';
import messagingService from 'js/messagingService';
import occmgmtUtils from 'js/occmgmtUtils';
import occurrenceManagementStateHandler from 'js/occurrenceManagementStateHandler';
import _ from 'lodash';

var exports = {};

var updatePCIInMap = function( occUID, pciUID, context ) {
    context = context ? context : appCtxService.ctx.aceActiveContext.context;
    if( pciUID && cdm.isValidObjectUid( pciUID ) ) {
        if( occUID && cdm.isValidObjectUid( occUID ) &&
            context.elementToPCIMap[ occUID ] ) {
            context.elementToPCIMap[ occUID ] = pciUID;
        } else {
            //Look for the product entry in PCI map and update the same
            var pciObject = cdm.getObject( pciUID );
            var productUID = pciObject.props.awb0Product.dbValues[ 0 ];

            for( var key in context.elementToPCIMap ) {
                if( context.elementToPCIMap.hasOwnProperty( key ) ) {
                    var pciModelObject = cdm
                        .getObject( context.elementToPCIMap[ key ] );
                    if( productUID === pciModelObject.props.awb0Product.dbValues[ 0 ] ) {
                        context.elementToPCIMap[ key ] = pciUID;
                        break;
                    }
                }
            }
        }
    }
};

/**
 * This method builds/updates and returns an element to PCI map based on given response. If given response has
 * an element to PCI map then it build a new one from it and returns that. If that is not available but an
 * element to PCI map exists on the occmgmt context then it updates that with the new parent information
 * received in the response and returns it.
 *
 * @param {ISOAResponse} response - GetOccurrences() SOA Response
 * @return The updated element to PCI map
 */
export let updateElementToPCIMap = function( response, contextState ) {
    var elementToPCIMap;
    var context = contextState ? contextState.context : appCtxService.ctx.aceActiveContext.context;

    if( response.elementToPCIMap ) {
        elementToPCIMap = {};
        for( var indx = 0; indx < response.elementToPCIMap[ 0 ].length; indx++ ) {
            var key = response.elementToPCIMap[ 0 ][ indx ].uid;
            var value = response.elementToPCIMap[ 1 ][ indx ].uid;
            elementToPCIMap[ key ] = value;
        }
    } else if( context.elementToPCIMap ) {
        var occUID = response.focusResourceChildOccurrence.resourceOccurrenceId;
        var pciUID = response.focusProductContext.uid;
        updatePCIInMap( occUID, pciUID, context );
        occUID = response.parentResourceOccurrence.resourceOccurrenceId;
        pciUID = response.parentProductContext.uid;
        updatePCIInMap( occUID, pciUID, context );
        elementToPCIMap = context.elementToPCIMap;
    }

    if( elementToPCIMap ) {
        context.elementToPCIMapCount = Object.keys( elementToPCIMap ).length;
    }

    return elementToPCIMap;
};

/**
 * @param {ViewModeLoadResult} viewModeLoadResult - The modelObject to access.
 * @param {ISOAResponse} response - GetOccurrences() SOA Response
 */
export let populateRequestPrefInfoOnOccmgmtContext = function( viewModeLoadResult, response, contextKey ) {
    /**
     * Populate the decision for objectQuota loading from the requestPref
     */
    viewModeLoadResult.useObjectQuotatoUnload = false;
    if( response.requestPref && response.requestPref.UseObjectQuotatoUnload ) {
        if( response.requestPref.UseObjectQuotatoUnload[ 0 ] === 'true' ) {
            viewModeLoadResult.useObjectQuotatoUnload = true;
        }
    }
};

/**
 * This method Populates the Panel-Id for Add Child/Sibling Panel based on the revOcc feature
 * @param {ISOAResponse} response - GetOccurrences() SOA Response
 * @param {ISOAResponse} contextKey - The current context
 */
export let populateFeaturesInfoOnOccmgmtContext = function( viewModeLoadResult, response, contextKey ) {
    var supportedFeatureList = occurrenceManagementStateHandler.getSupportedFeaturesFromPCI( response.rootProductContext );
    var childPanelId = '';
    var addUpDirectionElementsPanelId = 'MRM0AddUpDirectionElementsPanel';

    if( supportedFeatureList.Awb0RevisibleOccurrenceFeature === true ) {
        childPanelId = 'AddChildRevisableOccurrence';
    } else {
        childPanelId = 'Mrm0AddChildElement';
    }

    appCtxService.ctx[ contextKey ].childPanelId = childPanelId;
    appCtxService.ctx[ contextKey ].addUpDirectionElementsPanelId = addUpDirectionElementsPanelId;
    if ( supportedFeatureList.Awb0ChangeFeature === true ) {
        if ( _.isUndefined( appCtxService.ctx[contextKey].isChangeEnabled ) ) {
            var productContextInfo = cdm.getObject( response.rootProductContext.uid );
            if ( productContextInfo && productContextInfo.props.awb0ShowChange && productContextInfo.props.awb0ShowChange.dbValues ) {
                viewModeLoadResult.isChangeEnabled = productContextInfo.props.awb0ShowChange.dbValues[0] === '1';
                viewModeLoadResult.isRedLineMode = viewModeLoadResult.isChangeEnabled.toString();
            }
        } else {
            viewModeLoadResult.isChangeEnabled = appCtxService.ctx[contextKey].isChangeEnabled;
            viewModeLoadResult.isRedLineMode = _.isUndefined( viewModeLoadResult.isChangeEnabled ) ? viewModeLoadResult.isChangeEnabled : viewModeLoadResult.isChangeEnabled.toString();
        }
    }
};

/**
 * @param {ViewModeLoadResult} viewModeLoadResult - The modelObject to access.
 * @param {ISOAResponse} response - GetOccurrences() SOA Response
 */
export let populateSourceContextToInfoMapOnOccmgmtContext = function( viewModeLoadResult, response, contextKey ) {
    var context = appCtxService.getCtx( contextKey );
    if ( response.sourceContextToInfoMap ) {
        viewModeLoadResult.sourceContextToInfoMap = [];
        for ( var indx = 0; indx < response.sourceContextToInfoMap[0].length; indx++ ) {
            var key = response.sourceContextToInfoMap[0][indx].uid;
            var baselineInfo = response.sourceContextToInfoMap[1][indx];
            viewModeLoadResult.sourceContextToInfoMap[key] = baselineInfo;
        }
    } else if ( context.sourceContextToInfoMap ) {
        viewModeLoadResult.sourceContextToInfoMap = context.sourceContextToInfoMap;
    }
};

var getMessageString = function( messages, msgObj ) {
    _.forEach( messages, function( object ) {
        if( msgObj.msg.length > 0 ) {
            msgObj.msg += '<br>';
        }
        msgObj.msg += object.message;
        msgObj.level = _.max( [ msgObj.level, object.level ] );
    } );
};

export let processPartialErrors = function( response ) {
    var msgObj = {
        msg: '',
        level: 0
    };
    if( response.ServiceData.partialErrors ) {
        _.forEach( response.ServiceData.partialErrors, function( partialError ) {
            getMessageString( partialError.errorValues, msgObj );
        } );
    } else if( response.ServiceData.PartialErrors ) {
        _.forEach( response.ServiceData.PartialErrors, function( partialError ) {
            getMessageString( partialError.errorValues, msgObj );
        } );
    }

    if( msgObj.level <= 1 ) {
        messagingService.showInfo( msgObj.msg );
    } else {
        messagingService.showError( msgObj.msg );
    }
};

export let processFailedIndexError = function( error ) {
    var errorForInvalidIndex = false;
    _.forEach( error.cause.messages, function( message ) {
        if( message.code === 126209 ) {
            errorForInvalidIndex = true;
            return;
        }
    } );

    if( errorForInvalidIndex ) {
        messagingService
            .showInfo( 'Indexes for the product are in the process of being updated. You will now be switched to non-index mode.' );
        var value = {
            useProductIndex: false,
            startFreshNavigation: true
        };
        appCtxService.updatePartialCtx( 'aceActiveContext.context.configContext', value );
    }
};

var shouldClearRecipe = function( response ) {
    var shouldClear = false;
    //Should clear the filter/recipe only if recipe or filter has changed.
    if( response.filter && response.filter.recipe &&
        ( response.filter.recipe.length > 0 ||
            response.filter.recipe.length === 0 &&
            appCtxService.ctx.state.params.recipe ) ) {
        shouldClear = true;
    }
    return shouldClear;
};

/**
 * @param {ISOAResponse} response - SOA Response
 *
 * @return {Object} parameter map to store on URL.
 */
export let getNewStateFromGetOccResponse = function( response, contextKey ) {
    var c_uid;
    var pci_uid;

    if( response.focusResourceChildOccurrence ) {
        if( response.focusResourceChildOccurrence.resourceOccurrenceId &&
            cdm.isValidObjectUid( response.focusResourceChildOccurrence.resourceOccurrenceId ) ) {
            c_uid = response.focusResourceChildOccurrence.resourceOccurrenceId;
        } else if( response.focusResourceChildOccurrence.resourceOccurrence ) {
            c_uid = response.focusResourceChildOccurrence.resourceOccurrence.uid;
        }
    }

    //In M/S mode, we don't want to enforce active product as selection on user. So, focus Occ from
    //server will not be set as new c_uid. Will continue with c_uid that we have
    if( !_.isEmpty( appCtxService.ctx.aceActiveContext.context.pwaSelectionModel ) &&
        ( appCtxService.ctx.aceActiveContext.context.pwaSelectionModel.multiSelectEnabled ||
            appCtxService.ctx.aceActiveContext.context.pwaSelectionModel.getCurrentSelectedCount() > 1 ) ) {
        if( cdm.isValidObjectUid( response.focusProductContext.uid ) ) {
            c_uid = appCtxService.ctx[ contextKey ].currentState.c_uid;
        }
    }

    pci_uid = response.focusProductContext ? response.focusProductContext.uid : null;

    var newState = {};

    // This if block can be simplified once server starts sending parentResourceOccurrence.resourceOccurrenceId in case of product as well as SWC
    var o_uid;

    if( response.parentResourceOccurrence ) {
        if( !_.isEmpty( response.parentResourceOccurrence.resourceOccurrenceId ) ) {
            o_uid = response.parentResourceOccurrence.resourceOccurrenceId;
        } else if( response.parentResourceOccurrence.resourceOccurrence ) {
            o_uid = response.parentResourceOccurrence.resourceOccurrence.uid;
        }
    }

    let uwc = response.userWorkingContextInfo;
    if( uwc && uwc.sublocationAttributes && uwc.sublocationAttributes.awb0ActiveSublocation ) {
        newState.spageId = uwc.sublocationAttributes.awb0ActiveSublocation[0];
    }

    if( cdm.isValidObjectUid( o_uid ) ) {
        newState.o_uid = o_uid;
    }

    if( !cdm.isValidObjectUid( pci_uid ) ) {
        pci_uid = response.parentProductContext ? response.parentProductContext.uid : null;

        if( !cdm.isValidObjectUid( pci_uid ) ) {
            pci_uid = response.rootProductContext ? response.rootProductContext.uid : null;
        }
    }

    if( cdm.isValidObjectUid( pci_uid ) ) {
        newState.pci_uid = pci_uid;
    }

    if( !cdm.isValidObjectUid( newState.o_uid ) && appCtxService.ctx[ contextKey ].currentState.uid ) {
        newState.o_uid = appCtxService.ctx[ contextKey ].currentState.uid;
    }

    if( cdm.isValidObjectUid( c_uid ) ) {
        newState.c_uid = c_uid;
    } else {
        newState.c_uid = newState.o_uid;
    }

    if( shouldClearRecipe( response ) ) {
        newState.recipe = null;
    }

    /**
     * Determine 'top' modelObject.
     */
    if( cdm.isValidObjectUid( newState.o_uid ) ) {
        var oModelObject = cdm.getObject( newState.o_uid );

        if( oModelObject ) {
            var currModelObject = oModelObject;
            var topParentUid = oModelObject.uid;

            while( currModelObject ) {
                var nextParentUid = occmgmtUtils.getParentUid( currModelObject );

                if( nextParentUid ) {
                    currModelObject = cdm.getObject( nextParentUid );

                    if( currModelObject ) {
                        topParentUid = currModelObject.uid;
                    }
                } else {
                    break;
                }
            }

            newState.t_uid = topParentUid;
        }
    }
    return newState;
};

export default exports = {
    updateElementToPCIMap,
    populateRequestPrefInfoOnOccmgmtContext,
    populateFeaturesInfoOnOccmgmtContext,
    populateSourceContextToInfoMapOnOccmgmtContext,
    processPartialErrors,
    processFailedIndexError,
    getNewStateFromGetOccResponse
};
