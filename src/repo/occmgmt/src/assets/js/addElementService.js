// Copyright (c) 2022 Siemens

/**
 * @module js/addElementService
 */
import appCtxService from 'js/appCtxService';
import viewModelObjectService from 'js/viewModelObjectService';
import clipboardService from 'js/clipboardService';
import cdm from 'soa/kernel/clientDataModel';
import occurrenceManagementStateHandler from 'js/occurrenceManagementStateHandler';
import occmgmtUtils from 'js/occmgmtUtils';
import addObjectUtils from 'js/addObjectUtils';
import _ from 'lodash';
import eventBus from 'js/eventBus';
import navigationUtils from 'js/navigationUtils';
import adapterSvc from 'js/adapterService';
import cfgSvc from 'js/configurationService';
import AwPromiseService from 'js/awPromiseService';

var exports = {};

var ensureActiveContextIsCreated = function() {
    if( !appCtxService.ctx.aceActiveContext ) {
        appCtxService.updatePartialCtx( 'aceActiveContext.context', {} );
    }
};

export let getElementTobeReplaced = function( data ) {
    if( data.splitElement ) {
        return data.splitElement;
    }
    return data.eventMap['saveAsAndReplace.saveAs'].selectedObjectForReplaceElement;
};

export let getDisplayMode = function() {
    var viewModeInfo = appCtxService.ctx.ViewModeContext;
    if( viewModeInfo.ViewModeContext === 'ListView' || viewModeInfo.ViewModeContext === 'ListSummaryView' ) {
        return 'List';
    }
    return 'Tree'; //Server expects 'Tree' in case of Table mode as well.
};

export let getExpandedValue = function( occContext ) {
    var parent = occContext.currentState.c_uid;
    var vmc = occContext.vmc;
    if( parent && vmc ) {
        var parentIdx = _.findLastIndex( vmc.loadedVMObjects, function( vmo ) {
            return vmo.uid === parent;
        } );
        if( parentIdx > -1 ) {
            var parentVMO = vmc.getViewModelObject( parentIdx );
            if ( parentVMO.isExpanded ) {
                return 'true';
            }
        }
    }
    return 'false';
};

export let getSeperateQuantityAndPrepareAddInput = function() {
    exports.updateCtxForAceAddSiblingPanel();
    let addElementInput = appCtxService.ctx.aceActiveContext.context.addElementInput;
    if( occmgmtUtils.isTreeView() ) {
        addElementInput.fetchPagedOccurrences = true;
    }
    addElementInput.seperateQuantity = appCtxService.ctx.selected.props.awb0Quantity.dbValues[ 0 ] - 1;
    addElementInput.parent = appCtxService.ctx.aceActiveContext.context.addElementInput.parentElement;

    appCtxService.updatePartialCtx( 'aceActiveContext.context.addElement', addElementInput );
};

/**
 * set the variablity for Add child Panel
 */
export let setCtxAddElementInputParentElementToSelectedElement = function( parent, parentForAllowedTypes ) {
    var addElementInput = {};
    addElementInput.parentElement = viewModelObjectService
        .createViewModelObject( parent ? parent.uid : appCtxService.ctx.selected.uid );

    addElementInput.parentToLoadAllowedTypes = viewModelObjectService
        .createViewModelObject( parentForAllowedTypes ? parentForAllowedTypes.uid : appCtxService.ctx.selected.uid );

    ensureActiveContextIsCreated();

    appCtxService.updatePartialCtx( 'aceActiveContext.context.addElementInput', addElementInput );
};

/**
 * set the variablity for Add sibling Panel
 */
export let updateCtxForAceAddSiblingPanel = function() {
    var addElementInput = {};
    addElementInput.parentElement = viewModelObjectService
        .createViewModelObject( appCtxService.ctx.selected.props.awb0Parent.dbValues[ 0 ] );
    addElementInput.siblingElement = appCtxService.ctx.selected;
    // For adding a sibling, make sure that the parent for allowed types is populated properly.
    // In case of adding a sibling the parent is being calculated properly above and we need to set that here as well.
    addElementInput.parentToLoadAllowedTypes = addElementInput.parentElement;
    ensureActiveContextIsCreated();
    appCtxService.updatePartialCtx( 'aceActiveContext.context.addElementInput', addElementInput );
};

var saveCurrentSelectionUidToCheckSelectionChange = function( addElement ) {
    addElement.previousSelectionUid = appCtxService.ctx.selected.uid;
};

/**
 * Process input passed by consumer to the add element
 */
export let processAddElementInput = function() {
    var activeContext = appCtxService.ctx.aceActiveContext.context || {};
    var addElementInput = activeContext.addElementInput || {};
    var addElement = {};

    // set default values
    saveCurrentSelectionUidToCheckSelectionChange( addElement );
    addElement.parent = appCtxService.ctx.selected;
    addElement.parentToLoadAllowedTypes = appCtxService.ctx.selected;
    addElement.reqPref = exports.populateRequestPref();
    addElement.siblingElement = {};
    addElement.isCopyButtonEnabled = !occurrenceManagementStateHandler
        .isFeatureSupported( 'HideAddCopyButtonFeature_32' );
    addElement.operationType = 'Union';
    if( occmgmtUtils.isTreeView() ) {
        addElement.fetchPagedOccurrences = true;
    }

    // process custom input or extension values
    _.forEach( addElementInput, function( value, key ) {
        switch ( key ) {
            case 'parentElement':
                addElement.parent = value;
                break;
            case 'siblingElement':
                addElement.siblingElement = value;
                break;
            case 'parentToLoadAllowedTypes':
                addElement.parentToLoadAllowedTypes = value;
                break;
            case 'isCopyButtonEnabled':
                addElement.isCopyButtonEnabled = addElement.isCopyButtonEnabled && value;
                break;
            case 'addObjectIntent':
                addElement.addObjectIntent = value;
                break;
            case 'fetchPagedOccurrences':
                addElement.fetchPagedOccurrences = value;
                break;
            default:
                break;
        }
    } );

    // set the addElement
    appCtxService.updatePartialCtx( 'aceActiveContext.context.addElement', addElement );
    eventBus.publish( 'addElement.getInfoForAddElementAction' );
};

/**
 * Returns reqPref
 */
export let populateRequestPref = function() {
    var stateSvc = navigationUtils.getState();
    var toParams = {};

    if( stateSvc.params.fd ) {
        toParams.fd = [ stateSvc.params.fd ];
    }

    toParams.restoreAutoSavedSession = [ 'true' ];

    toParams.useGlobalRevRule = [ 'false' ];
    if( stateSvc.params.useGlobalRevRule ) {
        toParams.useGlobalRevRule[ 0 ] = stateSvc.params.useGlobalRevRule;
    }

    if( stateSvc.params.usepinx ) {
        toParams.useProductIndex = [ stateSvc.params.usepinx ];
    }

    toParams.calculateFilters = [ 'false' ];
    if( stateSvc.params.isfilterModified ) {
        toParams.calculateFilters[ 0 ] = 'true';
    }

    if( stateSvc.params.customVariantRule ) {
        toParams.customVariantRule = [ stateSvc.params.customVariantRule ];
    }
    _.forEach( appCtxService.ctx.aceActiveContext.context.persistentRequestPref, function( value, name ) {
        if( !_.isUndefined( value ) ) {
            toParams[ name ] = [ value.toString() ];
        }
    } );
    return toParams;
};

/**
 * Returns elements to be added either newly created or elements selected from Palette and Search tabs
 */
export let getElementsToAdd = function( data, createdObject, sourceObjects ) {
    if( Array.isArray( createdObject ) ) {
        return createdObject;
    }

    // check if created a new object ? if yes, create an array, insert this newly created element in it and return
    if( createdObject ) {
        var objects = [];
        objects.push( createdObject );
        return objects;
    }
    // return all selected element from palette and search tabs
    return sourceObjects;
};

/**
 * Returns elements to be replaced either newly created or element selected from Palette and Search tabs
 */
export let getPWASelectionToReplace = function( newElement ) {
    return newElement && newElement.uid && newElement.uid !== 'AAAAAAAAAAAAAA' ? newElement : appCtxService.ctx.selected;
};

/**
 * Returns elements to be replaced either newly created or element selected from Palette and Search tabs
 */
export let getElementsToReplace = function( data, createdObject, sourceObjects ) {
    var result = exports.getElementsToAdd( data, createdObject, sourceObjects );
    if( result && result.length === 1 ) {
        return result[ 0 ];
    }
};

export let setOperation = function( selectedOperation, operation ) {
    let op = { ...operation.value };
    op.name = selectedOperation;
    operation.update( op );
};

// Resets number of elements value to 1
export let resetNumberOfElements = function( numberOfElements ) {
    if( numberOfElements ) {
        numberOfElements.dbValue = 1;
        numberOfElements.dispValue = 1;
        return numberOfElements;
    }
    return 1;
};

export let setUnderlyingObjectsOfSourceObjectsAndReturn = function( data, sourceObjects ) {
    var underlyingObjects = [];
    for( var i in sourceObjects ) {
        if( sourceObjects[ i ].modelType.typeHierarchyArray.indexOf( 'Awb0Element' ) > -1 ) {
            var obj = cdm.getObject( sourceObjects[ i ].props.awb0UnderlyingObject.dbValues[ 0 ] );
            if( obj ) {
                underlyingObjects.push( obj );
            }
        } else {
            underlyingObjects.push( sourceObjects[ i ] );
        }
    }
    if( data.dispatch ) {
        data.dispatch( { path: 'data.underlyingObjects',   value: underlyingObjects } );
    }
    return underlyingObjects;
};

/**
 * This will create input for Save As Soa while creating copy of existing object
 *
 * @data data
 */
export let createSaveAsInput = function( data ) {
    var saveAsInput = [];
    var relateInfo = [];

    if( data.underlyingObjects ) {
        for( var index in data.underlyingObjects ) {
            var targetObject = data.underlyingObjects[ index ];

            var a;
            for( var b in data.deepCopyInfoMap[ 0 ] ) {
                if( data.deepCopyInfoMap[ 0 ][ b ].uid === targetObject.uid ) {
                    a = b;
                    break;
                }
            }
            var deepCopyInfoMap = data.deepCopyInfoMap[ 1 ][ a ];
            processDeepCopyDataArray( deepCopyInfoMap );

            var input = {
                targetObject: targetObject,
                saveAsInput: {},
                deepCopyDatas: deepCopyInfoMap
            };
            fillPropertiesInSaveAsInput( input.saveAsInput, targetObject );
            saveAsInput.push( input );
            relateInfo.push( {
                relate: true
            } );
        }
    }

    return {
        relateInfo: relateInfo,
        saveAsInput: saveAsInput
    };
};

/**
 * Process deep copy data array
 */
function processDeepCopyDataArray( deepCopyDataArray ) {
    for( var index = 0; index < deepCopyDataArray.length; index++ ) {
        var deepCopyData = deepCopyDataArray[ index ];
        deepCopyData.saveAsInput = {};

        var attachedObjectdVmo = viewModelObjectService
            .createViewModelObject( deepCopyData.attachedObject.uid );
        fillPropertiesInSaveAsInput( deepCopyData.saveAsInput, attachedObjectdVmo );

        delete deepCopyData.attachedObject.className;
        delete deepCopyData.attachedObject.objectID;

        var childDeepCopyDataArray = deepCopyData.childDeepCopyData;
        if( childDeepCopyDataArray ) {
            processDeepCopyDataArray( childDeepCopyDataArray );
        }
    }
}

/**
 * Fill properties in SaveAsInput object
 */
function fillPropertiesInSaveAsInput( saveAsInput, targetObject ) {
    saveAsInput.boName = targetObject.type;
    var propertiesToInclude = [ 'item_revision_id', 'object_desc' ];
    saveAsInput.stringProps = saveAsInput.stringProps || {};
    for( var property in propertiesToInclude ) {
        var propName = propertiesToInclude[ property ];
        if( targetObject.props[ propName ] && targetObject.props[ propName ].dbValues[ 0 ] ) {
            saveAsInput.stringProps[ propName ] = targetObject.props[ propName ].dbValues[ 0 ];
        }
    }
}

export let getNewlyAddedChildElements = function( data ) {
    // Collect the children for selected input parent.
    var newChildElements = [];

    if( data.addElementResponse.selectedNewElementInfo.newElements ) {
        for( var i = 0; i < data.addElementResponse.selectedNewElementInfo.newElements.length; ++i ) {
            newChildElements.push( data.addElementResponse.selectedNewElementInfo.newElements[ i ] );
        }
    }

    // if the element is already present in newChildElements don't add it.
    var selectednewInfosize = newChildElements.length;
    var vmc = appCtxService.ctx.aceActiveContext.context.vmc;
    if( vmc ) {
        // Collect the children for other reused parent instances
        for( var j = 0; j < data.addElementResponse.newElementInfos.length; j++ ) {
            var newElementInfo = data.addElementResponse.newElementInfos[j];
            var parentIdx = _.findLastIndex( vmc.getLoadedViewModelObjects(), function( vmo ) {
                return vmo.uid === newElementInfo.parentElement.uid;
            } );

            var parentVMO = vmc.getViewModelObject( parentIdx );

            // If parent is expanded then only add the children
            if( parentVMO && parentVMO.isExpanded ) {
                _.forEach( newElementInfo.newElements, function( newElement ) {
                    var found = 0;
                    for( var k = 0; k < selectednewInfosize; k++ ) {
                        found = 0;
                        if( newChildElements[k].uid === newElement.occurrenceId ) {
                            found = 1;
                            break;
                        }
                    }
                    if ( found === 0 ) {
                        newChildElements.push( newElement );
                    }
                } );
            }
        }
    }

    return newChildElements;
};

export let getTotalNumberOfChildrenAdded = function( data ) {
    var totalNewElementsAdded = 0;

    // First get the count of all the new children for input parent.
    if( data.selectedNewElementInfo.newElements ) {
        totalNewElementsAdded = data.selectedNewElementInfo.newElements.length;
    } else {
        // Get children count from other parent instances
        _.forEach( data.newElementInfos, function( newElementInfo ) {
            if( newElementInfo.newElements ) {
                totalNewElementsAdded += newElementInfo.newElements.length;
            }
        } );
    }
    return totalNewElementsAdded;
};

export let getAddToBookMarkInput = function( data, createdObject, sourceObjects ) {
    // New object add case
    if( createdObject ) {
        return {
            bookmark: {
                type: data.targetObjectToAdd.type,
                uid: data.targetObjectToAdd.uid
            },
            columnConfigInput: {
                clientName: '',
                fetchColumnConfig: true,
                hostingClientName: '',
                operationType: 'Union'
            },
            productsToBeAdded: [ {
                type: createdObject.type,
                uid: createdObject.uid
            } ]
        };
    } // Add one or more from palette/search
    return {
        bookmark: {
            type: data.targetObjectToAdd.type,
            uid: data.targetObjectToAdd.uid
        },
        productsToBeAdded: sourceObjects
    };
};

export let getNewlyAddedSwcProductInfo = function( data ) {
    return data.addToBookMarkResponse.addedProductsInfo[ data.addToBookMarkResponse.addedProductsInfo.length - 1 ];
};

export let getNewlyAddedSwcChildElements = function( data ) {
    return data.addToBookMarkResponse.addedProductsInfo.map( function( productInfo ) {
        return productInfo.rootElement;
    } );
};

export let getPCIOfNewlyAddedSwcProduct = function( data ) {
    return data.addToBookMarkResponse.addedProductsInfo[ data.addToBookMarkResponse.addedProductsInfo.length - 1 ].productCtxInfo;
};

/**
 * Extract allowed types from the response and return
 */
export let extractAllowedTypesInfoFromResponse = function( response ) {
    var populateAllowedTypes = {};
    var searchableTypesCount = 0;

    //Evaluate Object types for New Tab
    populateAllowedTypes.objectTypeName = response.allowedTypeInfos.filter( function( x ) {
        if( x.objectTypeName ) {
            return true;
        }
        return false;
    } ).map( function( x ) {
        return x.objectTypeName;
    } ).join();

    // Evaluate Object types for Pallet/Search Tab
    populateAllowedTypes.searchTypeName = response.allowedTypeInfos.filter( function( x ) {
        if( x.isSearchable ) {
            searchableTypesCount++;
        }
        if( x.searchTypeName ) {
            return true;
        }
        return false;
    } ).map( function( x ) {
        return x.searchTypeName;
    } ).join();

    if( response.preferredExists && response.preferredTypeInfo ) {
        populateAllowedTypes.preferredType = response.preferredTypeInfo.objectTypeName;
    }

    var allowedClipboardObjectTypes = getAllowedClipboardObjectTypes( populateAllowedTypes.searchTypeName );

    // update visible tabs depending on types
    populateAllowedTypes.allowedTabs = tabsToShowInAddPanel( populateAllowedTypes, searchableTypesCount,
        allowedClipboardObjectTypes );

    // we need allowedClipboardObjectTypes for palette.
    // searchTypeNames are used for both palette and search tabs
    // hence append allowedClipboardObjectTypes to the received searchTypeNames,
    if( allowedClipboardObjectTypes.length > 0 ) {
        populateAllowedTypes.searchTypeName = populateAllowedTypes.searchTypeName + ',' +
            allowedClipboardObjectTypes.join( ',' );
    }

    return populateAllowedTypes;
};

/**
 * @searchTypeName comma separated all allowed and searchable types
 * @returns array of Awb0Element types out of clipboard objects whose underlying object types are specified in
 *          searchable types
 */
function getAllowedClipboardObjectTypes( searchTypeName ) {
    var allowedClipboardObjectTypes = [];
    var clipboardObjects = clipboardService.instance.getCachableObjects();
    if( clipboardObjects.length > 0 ) {
        for( var i in clipboardObjects ) {
            if( clipboardObjects[ i ].modelType.typeHierarchyArray.indexOf( 'Awb0Element' ) > -1 ) {
                var elementObject = clipboardObjects[ i ];
                if( elementObject.props.awb0UnderlyingObject &&
                    elementObject.props.awb0UnderlyingObject.dbValues[ 0 ] ) {
                    var underlyingObject = cdm
                        .getObject( elementObject.props.awb0UnderlyingObject.dbValues[ 0 ] );
                    if( searchTypeName.split( ',' ).includes( underlyingObject.type ) ) {
                        allowedClipboardObjectTypes.push( elementObject.type );
                    }
                }
            }
        }
    }
    return allowedClipboardObjectTypes;
}

/**
 * process which tabs to be shown on add element panel
 */
function tabsToShowInAddPanel( populateAllowedTypes, searchableTypesCount, allowedClipboardObjectTypes ) {
    var tabs = [];
    if( populateAllowedTypes.objectTypeName.length > 0 ) {
        tabs.push( 'new' );
    }
    if( populateAllowedTypes.searchTypeName.length > 0 || allowedClipboardObjectTypes.length > 0 ) {
        tabs.push( 'palette' );
    }
    if( searchableTypesCount > 0 ) {
        tabs.push( 'search' );
        tabs.push( 'classification' );
    }
    return tabs.join();
}

export let clearCreatedElementField = function( ) {
    return { createdObject: undefined };
};


/**
 * initializePanelProperties
 * @function initializePanelProperties
 * @param {Object}data - the view model data
 */
export let initializePanelProperties = function( data ) {
    //reset subtype
    var createSubType = {};
    var vmo = {
        props: {
            type_name: {
                dbValues: [ 'PSOccurrence' ]
            }
        },
        propertyDescriptors: {}
    };
    createSubType = viewModelObjectService.constructViewModelObject( vmo, false );


    //Reset number of elements
    var numberOfElements = { ...data.numberOfElements };
    numberOfElements.dbValue = 1;

    return{
        numberOfElements
    };
};

export let setCreatedObjectOnState = function( createdObject, addPanelState ) {
    if( addPanelState && createdObject ) {
        let newAddPanelState = { ...addPanelState };
        if( Array.isArray( createdObject ) ) {
            newAddPanelState.createdObject = [ ...createdObject ];
        } else {
            newAddPanelState.createdObject = { ...createdObject };
        }
        return newAddPanelState;
    }
};

export let updateAddOccurrencePropertiesOnCreate = function( response, addElementState ) {
    var newAddElementState = {};
    if ( addElementState && response && response.requestPref && response.requestPref.Awb0AddOccurrencePropertiesOnCreate ) {
        newAddElementState = { ...addElementState.value };
        var addOccurrencePropertiesOnCreate = response.requestPref.Awb0AddOccurrencePropertiesOnCreate[0] === 'true';
        newAddElementState.AddOccurrencePropertiesOnCreate = addOccurrencePropertiesOnCreate;
        addElementState.update( newAddElementState );
    }
    return newAddElementState;
};


export let setStateAddElementInputParentElementToSelectedElement = function( parentUid, data, parentToLoadAllowedTypes ) {
    if ( parentUid && parentToLoadAllowedTypes && data && data.addElementState ) {
        var newAddElementState = { ...data.addElementState };

        var parentVMO = viewModelObjectService.createViewModelObject( parentUid );
        var parentToLoadAllowedTypesVMO = viewModelObjectService.createViewModelObject( parentToLoadAllowedTypes );
        newAddElementState.parent = parentVMO;
        newAddElementState.parentElement = parentVMO;
        newAddElementState.parentToLoadAllowedTypes = parentToLoadAllowedTypesVMO;
        newAddElementState.areNumberOfElementsInRange = true;

        newAddElementState.siblingElement = {};

        return { ...newAddElementState };
    }
};


export let updateStateForAceAddSiblingPanel = function( subPanelContext, data ) {
    if ( subPanelContext && subPanelContext.occContext && data && data.addElementState ) {
        var newAddElementState = { ...data.addElementState };

        var selectionUid = subPanelContext && subPanelContext.occContext && subPanelContext.occContext.selectedModelObjects && subPanelContext.occContext.selectedModelObjects.length > 0
            ? subPanelContext.occContext.selectedModelObjects[0].uid : appCtxService.ctx.selected.uid;
        var selectionVMO = viewModelObjectService.createViewModelObject( selectionUid );
        newAddElementState.siblingElement = selectionVMO;

        var parentUid = newAddElementState.siblingElement.props.awb0Parent.dbValues[0];
        var parentVMO = viewModelObjectService.createViewModelObject( parentUid );
        newAddElementState.parent = parentVMO;
        newAddElementState.parentToLoadAllowedTypes = parentVMO;
        newAddElementState.parentElement = parentVMO;

        return { ...newAddElementState };
    }
};


export let updateStateAddElement = function( data, subPanelContext ) {
    var newAddElementState = { ...subPanelContext.addElementState.value };

    newAddElementState.previousSelectionUid =
        subPanelContext && subPanelContext.occContext && subPanelContext.occContext.selectedModelObjects && subPanelContext.occContext.selectedModelObjects.length > 0
            ? subPanelContext.occContext.selectedModelObjects[0].uid : appCtxService.ctx.selected.uid;
    newAddElementState.isCopyButtonEnabled = !occurrenceManagementStateHandler.isFeatureSupported( 'HideAddCopyButtonFeature_32' );
    if ( occmgmtUtils.isTreeView() ) {
        newAddElementState.fetchPagedOccurrences = true;
    }

    subPanelContext.addElementState.update( newAddElementState );

    eventBus.publish( 'addElement.getInfoForAddElementAction' );
};

export let buildElementCreateInputAndUpdateState = function( data, subPanelContext ) {
    var newAddElementState = { ...subPanelContext.addElementState.value };
    var editHandler = subPanelContext.editHandler;
    if( data.createSubType && data.createSubType.props.type_name.dbValues[0] === 'PSOccurrence' ) {
        editHandler = data.editHandlers.addSubPanelEditHandler;
    }
    newAddElementState.elementCreateInput = addObjectUtils.getCreateInput( data, '', data.createSubType, editHandler );
    if( newAddElementState.elementCreateInput[0].createData.propertyNameValues &&
        newAddElementState.elementCreateInput[0].createData.propertyNameValues.qty_value &&
        newAddElementState.elementCreateInput[0].createData.propertyNameValues.qty_value[0] === '0' ) {
        newAddElementState.elementCreateInput[0].createData.propertyNameValues.qty_value[0] = '';
    }
    newAddElementState.numberOfElements = subPanelContext.numberOfElements;
    subPanelContext.addElementState.update( newAddElementState );
};

export let getPciForParentSelection = function( subPanelContext ) {
    if( subPanelContext.addElementState.parent ) {
        return cdm.getObject( occmgmtUtils.getProductContextForProvidedObject( subPanelContext.addElementState.parent, subPanelContext.occContext ) );
    }
    return subPanelContext.occContext.productContextInfo;
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
            deferred.resolve( {
                saveAsContext: context
            } );
        } );
    } );

    return deferred.promise;
};

export let getRequestPrefValue = function( occContext ) {
    let requestPref = {};

    _.forEach( occContext.persistentRequestPref, function( value, name ) {
        if( !_.isUndefined( value ) ) {
            requestPref[ name ] = [ value.toString() ];
        }
    } );

    var viewModeInfo = appCtxService.ctx.ViewModeContext;
    requestPref.displayMode = [ viewModeInfo.ViewModeContext === 'ListView' || viewModeInfo.ViewModeContext === 'ListSummaryView' ? 'List' : 'Tree' ];

    var val = getExpandedValue( occContext );
    requestPref.structExpanded = [ val ];

    return requestPref;
};

export let assignInitialValuesToXrtProperties = function( createType, editHandler ) {
    if( editHandler ) {
        let dataSource = editHandler.getDataSource();
        if( dataSource ) {
            let viewModelProps = [];
            let editableViewModelProperties = dataSource.getAllEditableProperties();
            _.forEach( editableViewModelProperties, function( vmProp ) {
                if( vmProp.propertyName ===  'qty_value' ) {
                    viewModelProps.push( {
                        propertyName: vmProp.propertyName,
                        dbValue: ''
                    } );
                }
            } );
            addObjectUtils.assignInitialValues( viewModelProps, createType, editHandler );
        }
    }
};

/**
 * Add Element service
 */

export default exports = {
    getDisplayMode,
    getSeperateQuantityAndPrepareAddInput,
    setCtxAddElementInputParentElementToSelectedElement,
    updateCtxForAceAddSiblingPanel,
    processAddElementInput,
    populateRequestPref,
    getElementsToAdd,
    getElementsToReplace,
    getPWASelectionToReplace,
    setOperation,
    resetNumberOfElements,
    setUnderlyingObjectsOfSourceObjectsAndReturn,
    createSaveAsInput,
    getNewlyAddedChildElements,
    getTotalNumberOfChildrenAdded,
    getAddToBookMarkInput,
    getNewlyAddedSwcProductInfo,
    getNewlyAddedSwcChildElements,
    extractAllowedTypesInfoFromResponse,
    clearCreatedElementField,
    initializePanelProperties,
    setCreatedObjectOnState,
    updateAddOccurrencePropertiesOnCreate,
    getExpandedValue,
    setStateAddElementInputParentElementToSelectedElement,
    updateStateForAceAddSiblingPanel,
    updateStateAddElement,
    buildElementCreateInputAndUpdateState,
    getPciForParentSelection,
    updateSaveAsContext,
    getRequestPrefValue,
    assignInitialValuesToXrtProperties,
    getElementTobeReplaced,
    getPCIOfNewlyAddedSwcProduct
};
