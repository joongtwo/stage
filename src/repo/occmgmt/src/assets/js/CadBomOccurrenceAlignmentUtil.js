// Copyright (c) 2022 Siemens

/**
 * @module js/CadBomOccurrenceAlignmentUtil
 */
import { getBaseUrlPath } from 'app';
import cdmSvc from 'soa/kernel/clientDataModel';
import AwPromiseService from 'js/awPromiseService';
import appCtxSvc from 'js/appCtxService';
import AwStateService from 'js/awStateService';
import localeService from 'js/localeService';
import _ from 'lodash';
import CadBomAlignmentUtil from 'js/CadBomAlignmentUtil';
import cbaConstants from 'js/cbaConstants';
import cbaObjectTypeService from 'js/cbaObjectTypeService';
import dataManagementService from 'soa/dataManagementService';
import occmgmtUtil from 'js/occmgmtUtils';
import messagingService from 'js/messagingService';

let exports = {};

/**
 * Update state from URL parameters
 *
 * @param {Object} paramsToBeStoredOnUrl The object containing URL parametrers
 */
export let addParametersOnUrl = function( paramsToBeStoredOnUrl ) {
    _.forEach( paramsToBeStoredOnUrl, function( value, name ) {
        AwStateService.instance.params[ name ] = value;
    } );
    AwStateService.instance.go( AwStateService.instance.current.name, AwStateService.instance.params );
};

/**
 * Checks if either Source or Target row has been selected from UI
 * @param {object} target - occContext object that need to be updated
 * @param {String} value - Value to be set for appCtx path
 */
export let updateCBAContextOnRowSelection = function( target, value ) {
    let isTrue = value === 'true';
    occmgmtUtil.updateValueOnCtxOrState( '', { isRowSelected: isTrue }, target );
};

/**
 * Update model object in context
 * @param {object} data - data
 */
export let updateModelObjectInContext = function( data ) {
    if( data && data.selection ) {
        let modelObject = cdmSvc.getObject( data.selection.uid );
        let valueToUpdate = {
            modelObject: modelObject,
            currentState: {
                uid: modelObject.uid
            }
        };
        occmgmtUtil.updateValueOnCtxOrState( '', valueToUpdate, data.scope.subPanelContext.inactiveContext );

        let valueToUpdateOnCbaContext;
        if( data.source === cbaConstants.CBA_SRC_CONTEXT ) {
            valueToUpdateOnCbaContext = { srcStructure: modelObject };
        } else if( data.source === cbaConstants.CBA_TRG_CONTEXT ) {
            valueToUpdateOnCbaContext = { trgStructure: modelObject };
        }
        occmgmtUtil.updateValueOnCtxOrState( '', valueToUpdateOnCbaContext, data.scope.subPanelContext.cbaContext );
    }
};

/**
 * Load properties for objects
 * @param {String} objects - list of object Uids to load given properties
 * @param {String} properties - List of properties to load
 *
 * @returns {Promise} After properties load return promise.
 */
export let loadProperties = function( objects, properties ) {
    if( objects && objects.length && properties && properties.length ) {
        let deferred = AwPromiseService.instance.defer();
        let uidsToload = [];
        _.forEach( objects, function( object ) {
            for( let index = 0; index < properties.length; index++ ) {
                const property = properties[ index ];
                if( !( object.props && object.props[ property ] ) ) {
                    uidsToload.push( object.uid );
                    break;
                }
            }
        } );
        if( uidsToload.length ) {
            dataManagementService.getProperties( uidsToload, properties ).then( function() {
                deferred.resolve( null );
            } );
            return deferred.promise;
        }
    }
    return AwPromiseService.instance.resolve( null );
};

/**
 * @param {Object} sourceObject The source object
 * @param {Object} targetObject The target object
 * @param {Object} invalidTypes List of invalid type of object and reason to open in CBA
 * @param {String} errorMessageKey error Message key to read from L10N file.
 * @returns {String} The error message text
 */
export let getErrorMessage = function( sourceObject, targetObject, invalidTypes, errorMessageKey ) {
    return AwPromiseService.instance.all( {
        uiMessages: localeService.getTextPromise( 'CadBomAlignmentMessages' )
    } ).then( function( localizedText ) {
        let deferred = AwPromiseService.instance.defer();
        let errorText;
        if( invalidTypes ) {
            let promise = loadProperties( invalidTypes, [ 'object_name' ] );
            promise.then( function() {
                let object = invalidTypes[ 0 ];
                let objNameProp = CadBomAlignmentUtil.getPropertyValueFromObject( object, 'props.object_name' );
                let objectName = objNameProp && objNameProp.dbValues.length ? objNameProp.dbValues[ 0 ] : '';
                if( errorMessageKey ) {
                    errorText = localizedText.uiMessages[ errorMessageKey ].format( objectName );
                } else {
                    if( !appCtxSvc.ctx.panelContext ) {
                        if( !sourceObject && !targetObject || invalidTypes.length === 0 ) {
                            errorText = localizedText.uiMessages.InvalidObjectsForAlignment;
                        } else if( !sourceObject ) {
                            errorText = localizedText.uiMessages.InvalidDesignForAlignment.format( objectName );
                        } else if( !targetObject ) {
                            errorText = localizedText.uiMessages.InvalidPartForAlignment.format( objectName );
                        }
                    } else {
                        if( !sourceObject ) {
                            errorText = localizedText.uiMessages.InvalidDesignDBOMForAlignment.format( objectName );
                        } else {
                            errorText = localizedText.uiMessages.InvalidPartEBOMForAlignment.format( objectName );
                        }
                    }
                }
                deferred.resolve( errorText );
            } );
        } else {
            deferred.resolve( errorText );
        }
        return deferred.promise;
    } );
};

/**
 * Get loaded VMO uid for the given underlying object uids
 *
 * @param {List} underlyingObjUids - List of uids of underlying objects
 * @param {string} contextKey - context key from which loaded VMO to fetch,
 * if not specified VMO will be fetched from both source and taget context.
 * @returns {List} - List of VMO uids
 */
export let getLoadedVMO = function( underlyingObjUids, contextKey ) {
    let outputVMOs = [];
    let contexts = [];

    if( contextKey ) {
        contexts[ 0 ] = contextKey;
    } else {
        contexts = appCtxSvc.ctx.splitView.viewKeys;
    }

    _.forEach( contexts, function( context ) {
        let loadedVMOs = appCtxSvc.ctx[ context ].vmc.loadedVMObjects;

        _.forEach( loadedVMOs, function( vmo ) {
            let awb0UnderlyingObject = CadBomAlignmentUtil.getPropertyValueFromObject( vmo, 'props.awb0UnderlyingObject' );
            if( awb0UnderlyingObject ) {
                let underlyingObjUid = awb0UnderlyingObject.dbValues[ 0 ];
                if( underlyingObjUids.includes( underlyingObjUid ) ) {
                    outputVMOs.push( vmo.uid );
                }
            }
        } );
    } );
    return outputVMOs;
};

/**
 * Register Split Mode
 */
export let registerSplitViewMode = function() {
    appCtxSvc.updatePartialCtx( cbaConstants.CTX_PATH_SPLIT_VIEW_MODE, true );
    appCtxSvc.updatePartialCtx( cbaConstants.CTX_PATH_SPLIT_VIEW_VIEWKEYS, [ cbaConstants.CBA_SRC_CONTEXT, cbaConstants.CBA_TRG_CONTEXT ] );
};

/**
 * Un-Register Split Mode
 */
export let unRegisterSplitViewMode = function() {
    let cbaViewKeys = appCtxSvc.getCtx( cbaConstants.CTX_PATH_SPLIT_VIEW_VIEWKEYS );
    _.forEach( cbaViewKeys, function( cbaViewKey ) {
        appCtxSvc.unRegisterCtx( cbaViewKey );
    } );
    appCtxSvc.unRegisterCtx( cbaConstants.CTX_PATH_SPLIT_VIEW );
};

/**
 * Check if current application is CBA
 * @returns {boolean} True if current application is CBA else False
 */
export let isCBAView = function() {
    let nameToken = appCtxSvc.getCtx( cbaConstants.CTX_PATH_SUBLOCATION_NAMETOKEN );
    return nameToken === 'com.siemens.splm.client.cba.CADBOMAlignment:CBASublocation';
};

/**
 * Check if split application is other than CBA
 * @returns {boolean} True if split application is other than CBA else False
 */
export let isNonCBASplitLocation = function() {
    let isSplitMode = appCtxSvc.getCtx( cbaConstants.CTX_PATH_SPLIT_VIEW_MODE );
    return isSplitMode && !isCBAView();
};

/**
 * Get children for a given parent node
 * @param {object} parentVMO - parent VMO for which all children to be retrieved
 *
 * @returns {Array} array of child objects
 */
export let getChildrenForVMO = function( parentVMO ) {
    let childObjects = [];
    let childVMOs = occmgmtUtil.getImmediateChildrenOfGivenParentNode( parentVMO );
    if( childVMOs ) {
        for( let i = 0, len = childVMOs.length; i < len; i++ ) {
            childObjects.push( childVMOs[ i ] );
            if( childVMOs[ i ].isLeaf ) {
                continue;
            }
            childObjects = childObjects.concat( getChildrenForVMO( childVMOs[ i ] ) );
        }
    }
    return childObjects;
};

/**
 * Returns object qualifier type for view model object
 * @param {ViewModelObject} vmo - View model object to check
 * @returns {string} objectQualifierType - Object qualifier type
 */
export let getObjectQualifierTypeFromVMO = function( vmo ) {
    let objectQualifierType = '';
    if( vmo && vmo.props ) {
        let dbValues = _.get( vmo.props, 'awb0UnderlyingObject.dbValues' );
        let dbValue = dbValues && dbValues.length > 0 ? dbValues[0] : null;
        if( dbValue ) {
            let objectInVMO = cdmSvc.getObject( dbValue );
            objectQualifierType = cbaObjectTypeService.getObjectQualifierType( objectInVMO );
        }
    }
    return objectQualifierType;
};

/**
 * Check if pma1IsPartRequired or pma1IsDesignRequired property value present in given VMO.
 * @param {ViewModelObject} vmo - Object to check.
 * @param {string} objectQualifierType - Object qualifier type.
 * @returns {boolean} - returns true if pma1IsPartRequired or pma1IsDesignRequired property value present in given VMO.
 */
export let isValidDesignOrPartReqPropValue = function( vmo, objectQualifierType ) {
    if( vmo && vmo.props && objectQualifierType ) {
        let dbValues = objectQualifierType === cbaConstants.DESIGN ? _.get( vmo.props, 'pma1IsPartRequired.dbValues' ) : cbaConstants.PART ? _.get( vmo.props, 'pma1IsDesignRequired.dbValues' ) : [];
        if( dbValues && dbValues.length > 0 ) {
            return dbValues[0] === '1' || dbValues[0] === 'true';
        }
    }
    return false;
};

/**
 * Check if ViewModelObject is valid for alignment. VMO will be valid if it has Part Required or Design Required property as true OR It's a SV Product Usage Occ OR is Multi Domain Part or Design object.
 * @param {ViewModelObject} vmo  - Object to check.
 * @returns {boolean} - returns true if vmo is valid for alignment else false.
 */
export let isValidObjectForAlignment = function( vmo ) {
    if( vmo && vmo.props ) {
        let objectQualifierType = getObjectQualifierTypeFromVMO( vmo );
        switch( objectQualifierType ) {
            case cbaConstants.DESIGN:
            case cbaConstants.PART:
                return isValidDesignOrPartReqPropValue( vmo, objectQualifierType );
            case cbaConstants.PRODUCT_EBOM:
                return vmo.props.awb0IsVi && vmo.props.awb0IsVi.dbValues[ 0 ] === '1';
            case cbaConstants.MULTI_DOMAIN_PART_OR_DESIGN:
                return true;
            default:
                return false;
        }
    }
    return false;
};

/**
 * Check if multiple structures are opened in CBA.
 * @returns {boolean} true if source and target both structures are opened in CBA
 */
export let areMultipleStructuresInCBA = function() {
    return appCtxSvc.getCtx( cbaConstants.CTX_PATH_ARE_MULTI_STR_IN_CBA );
};

/**
 * Gets icon image source path
 *
 * @param {Object} indicatorFile Indicator file name
 * @return {String} image source
 */
let getIconSourcePath = function( indicatorFile ) {
    let imagePath = getBaseUrlPath() + '/image/';
    imagePath += indicatorFile;
    return imagePath;
};

/**
 * Get the message for given key from given resource file, replace the parameter and return the localized string
 *
 * @param {Object} resourceFile - File that defines the message
 * @param {String} resourceKey - The message key which should be looked-up
 * @param {String} messageParam - The message parameter
 * @returns {String} localizedValue - The localized message string
 */
export let getLocalizedMessage = ( resourceFile, resourceKey, messageParam ) => {
    // var localizedValue = null;
    let resource = resourceFile;
    let localTextBundle = localeService.getLoadedText( resource );
    let message;
    if( localTextBundle ) {
        message = localTextBundle[ resourceKey ];
    } else {
        let asyncFun = function( localTextBundle ) {
            message = localTextBundle[ resourceKey ];
        };
        localeService.getTextPromise( resource ).then( asyncFun );
    }

    message && messageParam && messageParam.forEach( function( item, index ) {
        message = message.replace( `{${index}}`, messageParam[index] );
    } );

    return message;
};

/**
  * Process errors from response
  *
  * @param {Object} response - Server response
  * @param {Object} dontClearAlignmentIndicators - true to clear alignment check indicators else false
  * @returns {Object} null if response has error else response
  */
let processErrorsAndWarnings = function( response, dontClearAlignmentIndicators ) {
    let message = '';
    let level = 0;
    let error = response.ServiceData;
    if( error && error.partialErrors ) {
        _.forEach( error.partialErrors, function( partErr ) {
            if( partErr.errorValues ) {
                _.forEach( partErr.errorValues, function( errVal ) {
                    if( errVal.code ) {
                        if( message && message.length > 0 ) {
                            message += '\n' + errVal.message;
                        } else {
                            message += errVal.message;
                        }
                    }
                    level = errVal.level;
                } );
            }
        } );
        if( level <= 1 ) {
            messagingService.showInfo( message );
            return response;
        }
        if( !dontClearAlignmentIndicators ) {
            exports.clearAlignmentCheckStatus();
        }
        messagingService.showError( message );
        return null;
    }
    return response;
};

/**
  * Returns URL parameters
  *
  * @param {Object} contextKey - source or target context key
  * @returns {Object} url parameters for the input source or target context key
  */
export let getURLParameters = function( contextKey ) {
    let urlParamObj = {
        CBASrcContext: {
            selectionQueryParamKey: 'c_uid',
            openStructureQueryParamKey: 'o_uid',
            rootQueryParamKey: 'uid',
            productContextQueryParamKey: 'pci_uid',
            csidQueryParamKey: 'c_csid',
            secondaryPageIdQueryParamKey: 'spageId',
            topElementQueryParamKey: 't_uid',
            pageIdQueryParamKey: 'pageId',
            recipeParamKey: 'recipe',
            subsetFilterParamKey: 'filter'
        },
        CBATrgContext: {
            selectionQueryParamKey: 'c_uid2',
            openStructureQueryParamKey: 'o_uid2',
            rootQueryParamKey: 'uid2',
            productContextQueryParamKey: 'pci_uid2',
            csidQueryParamKey: 'c_csid2',
            secondaryPageIdQueryParamKey: 'spageId2',
            topElementQueryParamKey: 't_uid2',
            pageIdQueryParamKey: 'pageId2',
            recipeParamKey: 'recipe2',
            subsetFilterParamKey: 'filter2'
        }
    };
    return urlParamObj[ contextKey ];
};

/**
 * Update loaded view model objects in tree data provider of occcontext
 * 
 * @param {list} loadedViewModelObjects - loadedViewModelObjects
 * @param {object} occContext - occContext
 */
let updateLoadedVMOsInTreeDataProvider = function( loadedViewModelObjects, occContext ) {
    if( occContext ) {
        occContext.treeDataProvider.update( loadedViewModelObjects );
    }
};

/**
 * CAD-BOM Occurrence Alignment Util
 */
export default exports = {
    addParametersOnUrl,
    updateCBAContextOnRowSelection,
    updateModelObjectInContext,
    loadProperties,
    getErrorMessage,
    getLoadedVMO,
    registerSplitViewMode,
    unRegisterSplitViewMode,
    isCBAView,
    isNonCBASplitLocation,
    getChildrenForVMO,
    getObjectQualifierTypeFromVMO,
    isValidObjectForAlignment,
    areMultipleStructuresInCBA,
    getIconSourcePath,
    getLocalizedMessage,
    processErrorsAndWarnings,
    getURLParameters,
    updateLoadedVMOsInTreeDataProvider
};
