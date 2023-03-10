// Copyright (c) 2022 Siemens

/**
 * @module js/partMfgAddResourceService
 */
import appCtxService from 'js/appCtxService';
import AwPromiseService from 'js/awPromiseService';
import cdm from 'soa/kernel/clientDataModel';
import dms from 'soa/dataManagementService';
import eventBus from 'js/eventBus';
import occTypeSvc from 'js/occurrenceTypesService';
import uwPropertySvc from 'js/uwPropertyService';
import viewModelObjectService from 'js/viewModelObjectService';
import _ from 'lodash';

var exports = {};

var saveCurrentSelectionUidToCheckSelectionChange = function( addElement ) {
    addElement.previousSelectionUid = appCtxService.ctx.selected.uid;
};

/**
 * Process input passed by consumer to the add element
 */
export let pmProcessAddElementInput = function() {
    var addElement = {};

    // set default values
    addElement.previousSelectionUid = appCtxService.ctx.selected.uid;
    addElement.parent = appCtxService.ctx.PartMfg.parentElement;
    addElement.siblingElement = {};

    addElement.isCopyButtonEnabled = !exports.isFeatureSupported( 'HideAddCopyButtonFeature_32' );
    addElement.operationType = 'Union';
    addElement.fetchPagedOccurrences = false;

    // set the addElement
    appCtxService.updatePartialCtx( 'PartMfg.addElement', addElement );
};

/**
 * Return true if feature is supported, otherwise false
 */
export let isFeatureSupported = function( featureToCheck ) {
    var partMfgCtx = appCtxService.getCtx( 'PartMfg' );

    var supportedFeatures = partMfgCtx.supportedFeatures;

    if( !_.isEmpty( supportedFeatures ) && supportedFeatures[ featureToCheck ] ) {
        return true;
    }
    return false;
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

// Resets number of elements value to 1
export let resetNumberOfElements = function( data ) {
    if( data ) {
        data.dbValue = 1;
    }
    return;
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
    data.underlyingObjects = underlyingObjects;
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

    data.saveAs = {
        relateInfo: relateInfo,
        saveAsInput: saveAsInput
    };

    eventBus.publish( 'addResource.saveAsInputCreated' );
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
    var propertiesToInclude = [ 'item_revision_id', 'object_name', 'object_desc' ];
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

    return newChildElements;
};

export let clearCreatedElementField = function( data ) {
    if( data.createdObject ) {
        delete data.createdObject;
    }
};

export let setDefaultOccTypeOnElements = function( newElements, searchState ) {
    var deferred = AwPromiseService.instance.defer();
    var partMfgCtx = appCtxService.getCtx( 'PartMfg' );
    var parentElem = partMfgCtx.parentElement;

    var parentItemRev = cdm.getObject( parentElem.props.awb0UnderlyingObject.dbValues[ 0 ] );

    occTypeSvc.loadOccTypesInfo( parentItemRev, newElements ).then(
        function() {
            var inputs = [];
            _.forEach( newElements, function( newElement ) {
                // It is found that awb0UnderlyingObjectType is not loaded for objects selected from Pallete and Search tabs
                // So it is better to get type using awb0UnderlyingObject
                var awb0UnderlyingObj = cdm.getObject( newElement.props.awb0UnderlyingObject.dbValues[0] );
                var awb0UnderlyingType = awb0UnderlyingObj.type;
                var occTypeToSet = partMfgCtx.itemTypeDefOccTypeMap[awb0UnderlyingType];
                if( occTypeToSet ) {
                    var viewModelObject = viewModelObjectService.createViewModelObject( newElement.uid, 'EDIT', null, newElement  );
                    uwPropertySvc.setValue( viewModelObject.props.awb0OccType, occTypeToSet.internalName );
                    var input = dms.getSaveViewModelEditAndSubmitToWorkflowInput( viewModelObject );
                    dms.pushViewModelProperty( input, viewModelObject.props.awb0OccType );
                    inputs.push( input );
                }
            } );

            if( inputs.length > 0 ) {
                // Call SOA to save the modified data
                dms.saveViewModelEditAndSubmitWorkflow( inputs ).then( function( response ) {
                    exports.updateResourceAddedState( newElements, searchState );
                    deferred.resolve();
                }, function( err ) {
                    deferred.reject();
                } );
            } else {
                deferred.resolve();
            }
        } );
    return deferred.promise;
};

export let updateResourceAddedState = function( addedResources, searchState ) {
    let searchData = { ...searchState.value };
    searchData.newlyAddedResourcesState = addedResources;
    searchState.update( { ...searchData } );
};

/**
 * Part Manufacturing Add Resource service
 */

export default exports = {
    pmProcessAddElementInput,
    isFeatureSupported,
    getElementsToAdd,
    resetNumberOfElements,
    setUnderlyingObjectsOfSourceObjectsAndReturn,
    createSaveAsInput,
    getNewlyAddedChildElements,
    clearCreatedElementField,
    setDefaultOccTypeOnElements,
    updateResourceAddedState
};
