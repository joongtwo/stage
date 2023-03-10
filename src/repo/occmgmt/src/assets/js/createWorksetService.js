// Copyright (c) 2022 Siemens

/**
 * @module js/createWorksetService
 */
import _ from 'lodash';
import cdmService from 'soa/kernel/clientDataModel';
import appCtxSvc from 'js/appCtxService';
import localeService from 'js/localeService';
import addObjectUtils from 'js/addObjectUtils';
import occmgmtUtils from 'js/occmgmtUtils';
import AwPromiseService from 'js/awPromiseService';
import _uwPropSrv from 'js/uwPropertyService';
import adapterSvc from 'js/adapterService';
import cfgSvc from 'js/configurationService';
import dmSvc from 'soa/dataManagementService';
import _occmgmtBackingObjectProviderService from 'js/occmgmtBackingObjectProviderService';

var exports = {};
var _contextKey = null;

export let validateWorkingContext =  function( data ) {
    if( data.output.length > 0 ) {
        var created = data.output[0].objects;
        for( var i = 0; i < created.length; i++ ) {
            var createdObjectUId = cdmService.getObject( created[i].uid );
            if( createdObjectUId !== null ) {
                if( createdObjectUId.modelType.typeHierarchyArray.indexOf( 'Fnd0WorksetRevision' ) > -1 ) {
                    return created[i];
                }
            }
        }
    }
};

/**
 * Function to find if we can let the platform create the complete container and its Structure Contexts
 * based on whether we have opened an ace-indexed structure, discovery indexed or non-indexed.
 * NOTE:
 * Ace Indexed:
 * 1. When the pci has awb0AlternateConfiguration populated which has
 *  pci recipe ending with AWBIB [IB is for INDEXED BOM]
 *
 *Discovery indexed or Non-indexed:
 * case 1: [Partition scheme applied] When the pci has awb0AlternateConfiguration populated which has
 *  pci recipe ending with AWBCB [CB is for CLASSIC BOM]
 *case 2: Pci doesnt populate  awb0AlternateConfiguration
 *case 3: Opened Object is of type Wokset

 * Based on that, we want to decide if to use unificationSoa(createOrUpdateSavedSession) or
 * go with CreateOrRelateSubmit soa.
 *
 * @param {Object} occContext : Occmgmt context object
 * @return {boolean} True if the active PCI is not ACE indexed or it is Workset. False, otherwise.
 */
export let canContainerBePreparedInPlatform = function( occContext ) {
    let canCreateFullContainerInPlatform = true;
    if ( occContext && occContext.topElement && !isWorkset( occContext.topElement ) /* Workset cannot be ace indexed */ ) {
        var pci = occContext.productContextInfo;
        if ( pci && pci.props.awb0AlternateConfiguration &&  pci.props.awb0AlternateConfiguration.dbValues[0] !== null
            && pci.props.awb0AlternateConfiguration.dbValues[0].endsWith( 'AWBIB' ) || !occmgmtUtils.isMinimumTCVersion( 13, 3 ) ) {
            canCreateFullContainerInPlatform = false;
        }
    }
    return canCreateFullContainerInPlatform;
};

/**

 * Function to find if we have opened an ace-indexed structure, discovery indexed or non-indexed.
 * NOTE:
 * Ace Indexed:
 * 1. When the pci has awb0AlternateConfiguration populated which has
 *  pci recipe ending with AWBIB [IB is for INDEXED BOM]
 *
 *Discovery indexed or Non-indexed:
 * case 1: [Partition scheme applied] When the pci has awb0AlternateConfiguration populated which has
 *  pci recipe ending with AWBCB [CB is for CLASSIC BOM]
 *case 2: Pci doesnt populate  awb0AlternateConfiguration


 * Based on that, we want to decide if to use unificationSoa(createOrUpdateSavedSession) or
 * go with CreateOrRelateSubmit soa.

 *  * @param {*} occContext occContexts

 */
export let isAceIndexedProduct = function( occContext ) {
    if ( occContext ) {
        var pci = occContext.productContextInfo;
        if ( pci && pci.props.awb0AlternateConfiguration &&  pci.props.awb0AlternateConfiguration.dbValues[0] !== null && pci.props.awb0AlternateConfiguration.dbValues[0].endsWith( 'AWBIB' ) ) {
            return true;
        }
        return false;
    }
};

/**
  * Set the default properties for object_name.
  *
  * @param {*} createType The object type being created
  * @param {*} type the string
  * @param {*} xrtType Create/saveAs
  * @param {*} editHandler editHandleroccContext
  */
export let prePopulateNameField = ( createType, type, xrtType, editHandler, occContext ) => {
    let updatedProps = [];
    let editableProperties = addObjectUtils.getObjCreateEditableProperties( createType, xrtType, [ 'object_name' ], editHandler );

    if( occContext ) {
        var topNode = occContext.topElement.props.object_string.dbValues[0];


        // Object Name
        if( editableProperties.object_name ) {
            let object_name =  { ...editableProperties.object_name };
            object_name.dbValue = type.replace( '{0}', topNode );
            object_name.value = type.replace( '{0}', topNode );
            object_name.isRequired = true;
            object_name.valueUpdated = true;
            updatedProps.push( object_name );
        }

        addObjectUtils.assignInitialValues( updatedProps, createType, editHandler );
    }
};

/**
 * Adding a ctx variable worksetTopNode and worksetTopItemNode when the workset is opened.
  * This variable will give the modelTypeHierarchy on th top node when it is workset
  */
export let updateCtxWithTopNodeHierarchy = function() {
    var occMgmtCtx = appCtxSvc.getCtx( _contextKey );
    if ( occMgmtCtx && occMgmtCtx.worksetTopNode === undefined && occMgmtCtx.openedElement && occMgmtCtx.openedElement.props.awb0UnderlyingObject ) {
        var createdObject = cdmService.getObject( occMgmtCtx.openedElement.props.awb0UnderlyingObject.dbValues[0] );
        if ( createdObject !== null && createdObject.modelType.typeHierarchyArray.indexOf( 'Fnd0WorksetRevision' ) > -1 ) {
            occmgmtUtils.updateValueOnCtxOrState( 'worksetTopNode', createdObject, _contextKey );
            if ( createdObject.props && createdObject.props.items_tag ) {
                var worksetItemtag = createdObject.props.items_tag.dbValues[0];
                var worksetItem = cdmService.getObject( worksetItemtag );
                if( worksetItem && _.isEmpty( worksetItem.prop ) ) {
                    dmSvc.getProperties( [  worksetItem.uid ], [ 'is_modifiable' ] ).then( function() {
                        occmgmtUtils.updateValueOnCtxOrState( 'worksetItemTopNode', worksetItem, _contextKey );
                    } );
                } else if( worksetItem ) {
                    occmgmtUtils.updateValueOnCtxOrState( 'worksetItemTopNode', worksetItem, _contextKey );
                }
            }
        }
    }
};

/**
 * Adding a ctx variable appSessionWorksetNode when app session with workset is opened.
  */
export let updateCtxWithAppSessionWorksetNodeHierarchy = function(  ) {
    var occMgmtCtx = appCtxSvc.getCtx( _contextKey );
    if( occMgmtCtx && occMgmtCtx.appSessionWorksetNode === undefined  && occMgmtCtx.openedElement
    && occMgmtCtx.openedElement.modelType.typeHierarchyArray.indexOf( 'Fnd0AppSession' ) > -1  && occMgmtCtx.elementToPCIMap ) {
        for( var k in occMgmtCtx.elementToPCIMap ) {
            let pci_uid = occMgmtCtx.elementToPCIMap[ k ];
            let pciObject = cdmService.getObject( pci_uid );
            if( pciObject ) {
                let productObject = cdmService.getObject( pciObject.props.awb0Product.dbValues[ 0 ] );
                let isAppSessionWithWorkset = productObject && productObject.modelType.typeHierarchyArray.indexOf( 'Fnd0WorksetRevision' ) > -1;

                if( isAppSessionWithWorkset ) {
                    let worksetNodeInSession = cdmService.getObject( k );
                    let value = {
                        appSessionWorksetNode: worksetNodeInSession,
                        appSessionWorksetUnderlyingObject: productObject
                    };
                    occmgmtUtils.updateValueOnCtxOrState( '', value, _contextKey );
                    break;
                }
            }
        }
    }
};


/**
 * Adding a ctx variable SaveAsOnConcurrentSave for deciding if we want ReviseTabOpen or not
  */
export let populateSaveAsOnConcurrentSaveOnCtx = function() {
    var occMgmtCtx = appCtxSvc.getCtx( _contextKey );
    if ( occMgmtCtx ) {
        occmgmtUtils.updateValueOnCtxOrState( 'saveAsOnConcurrentSave', true, _contextKey );
    }
};

/** Sets the ui value for workset replay tooltipp
 * @param {Object} replayWorksetText - The tooltip for workset replay
 */
export let setWorksetReplayToolTip = function( replayWorksetText ) {
    var selections = appCtxSvc.getCtx( 'mselected' );
    var resource = localeService.getLoadedText( 'OccurrenceManagementSubsetConstants' );
    replayWorksetText.uiValue = resource.replaySubsetTooltip;
    if( selections && selections.length === 1 && isWorkset( selections[0] ) ) {
        replayWorksetText.uiValue = resource.replayWorksetTooltip;
    }
};

/*
 * Check if the element is Workset
 * @param {Object} parentObj The parent element.
 */
export let isWorkset = function( parentObj ) {
    var isObjectWorkset = false;
    if( parentObj && parentObj.props && parentObj.props.awb0UnderlyingObject ) {
        var parentUnderlyingObj = cdmService.getObject( parentObj.props.awb0UnderlyingObject.dbValues[ 0 ] );
        if( parentUnderlyingObj && parentUnderlyingObj.modelType.typeHierarchyArray.indexOf( 'Fnd0WorksetRevision' ) > -1 ) {
            isObjectWorkset = true;
        }
    }
    return isObjectWorkset;
};
/**
  * Function to get the backing object  and
  * assign to the data  membEr topLine.
  * @param {Object} data
  */
export let getBackingObject = function( modelObject, data ) {
    _getBomlineOfTopLine( modelObject ).then( function( response ) {
        data.dispatch( { path: 'data.topLine.dbValue', value:response } );
    } );
};

/**
  * Async function to get the backing object's for input viewModelObject's.
  * viewModelObject's should be of type Awb0Element.
  * @param {Object} viewModelObjects - of type Awb0Element
  * @return {Promise} A Promise that will be resolved with the requested backing object's when the data is available.
  *
  */
let _getBomlineOfTopLine = function( modelObject ) {
    let deferred = AwPromiseService.instance.defer();
    _occmgmtBackingObjectProviderService.getBackingObjects( [ modelObject ] ).then( function( response ) {
        return deferred.resolve( response[0].uid );
    } );
    return deferred.promise;
};

/**
  * Function to get the mapValue based on the  viewModelProperty objects type.
  * @param {Object} viewModelProperty
  * @return {String}  The type of the property
  */
let getPropType = function( vmProp ) {
    var mapValue;
    if ( vmProp ) {
        switch ( vmProp.type ) {
            case 'BOOLEAN':
                mapValue = 'boolValues';
                break;
            case 'STRING':
                mapValue = 'stringValues';
                break;
            case 'INTEGER':
                mapValue = 'intValues';
                break;
        }
    }
    return mapValue;
};

/**
  * Function to populate compound input
  * @param {Object} vmProperty
  * @param {object}  createInputmap
  */
let populateCompoundCreateInput = function( vmProp, compoundProperty, createInputMap, propType ) {
    var compoundObject = cdmService.getObject( _uwPropSrv.getSourceObjectUid( vmProp ) );
    var compoundCreateInputMap = {};
    compoundCreateInputMap[''] = {
        boName:compoundObject.modelType.owningType,
        propertyNameValues: {},
        compoundCreateInput: {}
    };
    for( var i = 0; i < compoundProperty.length; i++ ) {
        var propertyName = '';
        var parentTypeName = null;
        if( compoundProperty[ i ].startsWith( 'REF' ) ) {
            var index = compoundProperty[ i ].indexOf( ',' );
            propertyName = compoundProperty[ i ].substring( 4, index ).trim();
            parentTypeName = compoundProperty[ i ].substring( index + 1, compoundProperty[ i ].length - 1 ).trim();
        }
    }
    var propertyName = {};
    _.set( propertyName, propType, _uwPropSrv.getValueStrings( vmProp ) );
    var compoundCreIn = compoundCreateInputMap[''];
    var propertyNameValues = compoundCreIn.propertyNameValues;
    _.set( propertyNameValues, [ compoundProperty[1] ], propertyName );
    var name = compoundProperty[0];
    createInputMap[''].compoundCreateInput[name] = [ compoundCreateInputMap[''] ];
};


/**
  * Function to create input for the createAndUpdateSavedSession soa.
  *
  * @param {Object} data
  * @return {object} created input
  *
  */
export let createInputForCreateAndUpdateSavedSessionSOA = function( data, editHandler ) {
    var createInputMap = {};
    var createType = data.addPanelState.creationType.props.type_name.dbValues[ 0 ];
    createInputMap[''] = {
        boName: createType,
        propertyNameValues: {},
        compoundCreateInput: {}
    };
    //Create property name values
    if( editHandler ) {
        let dataSource = editHandler.getDataSource();
        if( dataSource ) {
            let allEditableProperties = dataSource.getAllEditableProperties();
            _.forEach( allEditableProperties, function( vmProp ) {
                if ( vmProp && ( vmProp.isAutoAssignable || _uwPropSrv.isModified( vmProp ) ) ) {
                    var propType = getPropType( vmProp );
                    //Check if the vmProp is a compound property
                    var compoundProperty = vmProp.propertyName.split( '.' );

                    if( compoundProperty.length > 1 ) {
                        populateCompoundCreateInput( vmProp, compoundProperty, createInputMap, propType );
                    } else {
                        var value = [];
                        if ( vmProp.type === 'BOOLEAN' ) {
                            value.push( vmProp.dbValue );
                        } else {
                            value = _uwPropSrv.getValueStrings( vmProp );
                        }

                        if ( value !== undefined ) {
                            var propertyName = {};
                            _.set( propertyName, propType, value );
                            var createInput = createInputMap[''];
                            if ( createInput ) {
                                var propertyNameValues = createInput.propertyNameValues;
                                _.set( propertyNameValues, [ vmProp.propertyName ], propertyName );
                            }
                        }
                    }
                }
            } );
        }

        //Create propertyNameValues for the customPanelProperty
        if( dataSource.getDeclViewModel() && dataSource.getDeclViewModel().customPanelInfo ) {
            _.forEach( dataSource.getDeclViewModel().customPanelInfo, function( customPanelVMData ) {
                // copy custom panel's properties
                var oriVMData = customPanelVMData._internal.origDeclViewModelJson.data;
                _.forEach( oriVMData, function( propVal, propName ) {
                    if ( _.has( customPanelVMData, propName ) ) {
                        var vmProp = customPanelVMData[propName];
                        var propType = getPropType( vmProp );
                        var value = [];
                        if ( vmProp.type === 'BOOLEAN' ) {
                            if( vmProp.dbValue === null ) {
                                vmProp.dbValue = false;
                            }
                            value.push( vmProp.dbValue );
                        } else {
                            value = _uwPropSrv.getValueStrings( vmProp );
                        }

                        if ( value !== undefined ) {
                            var propertyName = {};
                            _.set( propertyName, propType, value );

                            var createInput = createInputMap[''];
                            if ( createInput ) {
                                var propertyNameValues = createInput.propertyNameValues;
                                _.set( propertyNameValues, [ propName ], propertyName );
                            }
                        }
                    }
                } );
            } );
        }
    }
    //Populate product and configs
    var productAndConfigsToCreate = {
        structureRecipe: {
            structureContextIdentifier: {
                product: {
                    uid: data.topLine.dbValue
                }
            }
        }
    };
    var sessionToCreateOrUpdate = {
        objectToCreate: {
            creInp: _.get( createInputMap, '' )
        }
    };
    return [ {
        clientId: 'CreateObject',
        sessionToCreateOrUpdate: sessionToCreateOrUpdate,
        productAndConfigsToCreate: [ productAndConfigsToCreate ]

    } ];
};

export let getVisibleTabsForSaveAsWorksetPanel = function( reviseTab, newTab, panelContext ) {
    let visibleTabs = [];
    if( panelContext ) {
        if( panelContext.ReviseHidden !== 'true' ) {
            visibleTabs.push( reviseTab );
        }

        if( panelContext.SaveAsHidden !== 'true' ) {
            visibleTabs.push( newTab );
        }
    }
    return visibleTabs;
};

export let setContextKey = function( key ) {
    _contextKey = key;
};

export let updateSaveAsContext = function( selectedObj ) {
    var deferred = AwPromiseService.instance.defer();
    cfgSvc.getCfg( 'saveAsRevise' ).then( function( saveAsRevise ) {
        var selectedObjs = [];
        selectedObjs.push( selectedObj );
        var adaptedObjsPromise = adapterSvc.getAdaptedObjects( selectedObjs );
        adaptedObjsPromise.then( function( adaptedObjs ) {
            var context;
            adaptedObjs[ 0 ].modelType.typeHierarchyArray.forEach( function( element ) {
                if( saveAsRevise[ element ] ) {
                    context = saveAsRevise[ element ];
                }
            } );
            if( context ) {
                context.SelectedObjects = [ adaptedObjs[ 0 ] ];
            } else {
                context = {
                    SelectedObjects: [ adaptedObjs[ 0 ] ]
                };
            }

            deferred.resolve( context );
        } );
    } );
    return deferred.promise;
};

/**
 * Update the selection to workset before save as
 *
 * @param {Object} topElement - top element (Workset)
 */
export let changeSelectionToWorksetForConcurrentSave = function( topElement ) {
    appCtxSvc.updatePartialCtx( 'selected', topElement );
};

export var isAutoSaveWorksetEnabled = ( contextKey ) => {
    var isAutoSaveWorkset = false;

    if( occmgmtUtils.isMinimumTCVersion( 14, 2 ) ) {
        // Auto save of workset feature only available from Tc14.2 onwards.
        let inWorksetContext = appCtxSvc.ctx[contextKey].worksetTopNode !== undefined && appCtxSvc.ctx[contextKey].worksetTopNode.modelType.typeHierarchyArray.indexOf( 'Fnd0WorksetRevision' ) > -1;
        let inAppSessionWithWorkset = appCtxSvc.ctx[contextKey].appSessionWorksetNode !== undefined;
        if( inWorksetContext || inAppSessionWithWorkset ) {
            isAutoSaveWorkset = true;
        }
    }
    return isAutoSaveWorkset;
};


export default exports = {
    validateWorkingContext,
    updateCtxWithTopNodeHierarchy,
    setWorksetReplayToolTip,
    isWorkset,
    prePopulateNameField,
    setContextKey,
    createInputForCreateAndUpdateSavedSessionSOA,
    updateSaveAsContext,
    getBackingObject,
    populateSaveAsOnConcurrentSaveOnCtx,
    canContainerBePreparedInPlatform,
    isAceIndexedProduct,
    getVisibleTabsForSaveAsWorksetPanel,
    changeSelectionToWorksetForConcurrentSave,
    isAutoSaveWorksetEnabled,
    updateCtxWithAppSessionWorksetNodeHierarchy
};
