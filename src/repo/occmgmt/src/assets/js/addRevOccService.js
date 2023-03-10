// Copyright (c) 2022 Siemens

/**
* @module js/addRevOccService
*/
import AwPromiseService from 'js/awPromiseService';
import dmSvc from 'soa/dataManagementService';
import addObjectUtils from 'js/addObjectUtils';
import cdmSvc from 'soa/kernel/clientDataModel';
import appCtxService from 'js/appCtxService';
import _ from 'lodash';

/**
 *@param {Object} data - The view model data
 *@param {Object} addPanelState - addPanelState
 *@return {Object} newAddPanelState
 */
export const loadCreatedObjects = function( data, addPanelState ) {
    var newAddPanelState = { ...addPanelState };
    newAddPanelState.createdPartObject = cdmSvc.getObject( data.dataProviders.getChildRevisionDataProvider.viewModelCollection.loadedVMObjects[0].uid );
    return newAddPanelState;
};

/**
 * Return Revision data to dataprovider
 *
 // eslint-disable-next-line valid-jsdoc
 * @param {Object} createdObject - The view model data
 * @param {Array} sourceObjects - Array
 * @returns {Object} revisionData
 */
export const getRevisionData = function(  createdObject, sourceObjects ) {
    var results = [];

    //  check if new object is created
    if( createdObject ) {
        results.push( createdObject );
    } else if( sourceObjects ) {
        //  return all selected element from palette and search tabs
        results = sourceObjects;
    }

    var revisionData = {
        searchResults: results,
        totalFound: results.length
    };

    if( revisionData.searchResults.length > 0 ) {
        var revisionObject = revisionData.searchResults[ 0 ];
        if( revisionObject.props.awb0Archetype !== undefined ) {
            // We got an Awb0Element as input
            cdmSvc.getObject( revisionObject.props.awb0Archetype.dbValues[ 0 ] );
        }
    }
    return revisionData;
};

/**
 * Adds Properties and sets Create Input Context
 * @param {Object} data - The view model data
 * @param {Object} subPanelContext - subPanelContext
 */
export let buildOccurrenceCreateInputAndUpdateState = function( data, subPanelContext ) {
    let numberOfObjects = 1;
    // Populates 'numberOfObjects' variable with the number of objects selected in Palette/Search Tab
    if( data.eventData ) {
        numberOfObjects = data.eventData.sourceObjects.length;
    }
    let newAddElementState = { ...subPanelContext.addElementState.value };
    let editHandler = subPanelContext.editHandler;
    if(  subPanelContext.addElementState && subPanelContext.addElementState.occType !== '' ) {
        editHandler = data.editHandlers.addSubPanelEditHandler;
    }
    let createData = [];
    // Populates the create Data Array which will be consumed by "addObject3" SOA as createInputs
    for( let object = 1; object <= numberOfObjects; object++ ) {
        let elementCreateInputs = addObjectUtils.getCreateInput( data, '', subPanelContext.addElementState.occType, editHandler );
        createData.push( elementCreateInputs[0].createData );
    }
    newAddElementState.createData = createData;
    newAddElementState.numberOfElements = subPanelContext.numberOfElements;
    subPanelContext.addElementState.update( newAddElementState );
};

/**
* Update the Add Element State
*
* @param {Object} subPanelContext SubPanel Context to be updated
* @param {Object} revOccType Occurence Type to be updated into subPanelContext
* @returns {Object} updated addPanelState
*/
export let updateAddElementState = function( subPanelContext, revOccType ) {
    let newAddElementState = { ...subPanelContext.addElementState.value };
    if( revOccType !== undefined && revOccType !== '' ) {
        newAddElementState.occType = revOccType;
    }
    subPanelContext.addElementState.update( newAddElementState );
    return newAddElementState;
};

/**
* Get the Add Part Child/Sibling Panel ID based on different Scenarios
* @param {Object} selectedObject Object currently selected
* @param {Object} childOrSibling Flag to indicate which command Child or Sibling has been clicked
* @returns {Object} Add Part Panel ID of the Panel to show
*/
export let addPartPanelSelection = function( selectedObject, childOrSibling ) {
    // For Partition selection Scenario
    if( selectedObject.modelType.typeHierarchyArray.indexOf( 'Fgf0PartitionElement' ) > -1 && childOrSibling === 'child' ) {
        return 'Awb0AddPartChild';
    }
    let partRevisionPreferences = appCtxService.ctx.preferences.FND0_COLLABORATIVE_PARTREVISION_TYPES;
    let productRevisionPreferences = appCtxService.ctx.preferences.FND0_PRODUCTEBOMREVISION_TYPES;
    let selectedObjectUnderlyingObjType = '';
    let parentUid = '';
    if( selectedObject.props.awb0UnderlyingObjectType !== undefined ) {
        selectedObjectUnderlyingObjType = selectedObject.props.awb0UnderlyingObjectType.dbValues[0];
    }
    if( selectedObject.props.awb0Parent !== undefined ) {
        parentUid = selectedObject.props.awb0Parent.dbValues[0];
    }
    // For Root Object
    if( ( partRevisionPreferences.indexOf( selectedObjectUnderlyingObjType ) !== -1 || productRevisionPreferences.indexOf( selectedObjectUnderlyingObjType ) !== -1 ) && parentUid === null ) {
        return 'Awb0AddPartChild';
    }
    let parentViewModelObject = cdmSvc.getObject( parentUid );
    let parentObjectType = '';
    let parentUnderlyingObjectType = '';
    if( parentViewModelObject !== null ) {
        parentObjectType = parentViewModelObject.type;
    }
    // For Partition 'awb0UnderlyingObjectType' doesn't get populated in ViewModelObject extracted from cdmSvc
    if(  parentViewModelObject !== null  && parentViewModelObject.props.awb0UnderlyingObjectType !== undefined
        && parentViewModelObject.modelType.typeHierarchyArray.indexOf( 'Fgf0PartitionElement' ) < 0 ) {
        parentUnderlyingObjectType = parentViewModelObject.props.awb0UnderlyingObjectType.dbValues[0];
    }
    if( childOrSibling === 'child' ) {
        // For 2 Scenarios:-
        // 1. Any SMM 1 object - When Selected object is SMM 1 object
        // 2. Workset Scenario - When Selected object is SMM 1 object and parent is 'Workset'
        if(   partRevisionPreferences.indexOf( selectedObjectUnderlyingObjType ) !== -1  ||  productRevisionPreferences.indexOf( selectedObjectUnderlyingObjType ) !== -1
            ||   ( partRevisionPreferences.indexOf( selectedObjectUnderlyingObjType ) !== -1 || productRevisionPreferences.indexOf( selectedObjectUnderlyingObjType ) !== -1 ) && parentUnderlyingObjectType === 'Fnd0WorksetRevision'   ) {
            return 'Awb0AddPartChild';
        }// For SMM 0 Object

        return'Awb0AddChildElementDeclarative';
    }

    // For 2 Scenarios:-
    // 1. Any SMM 1 object - When Selected object's parent is SMM 1 object
    // 2. Partition Scenario - When Selected object's parent is 'Partition'
    if(  partRevisionPreferences.indexOf( parentUnderlyingObjectType ) !== -1  || productRevisionPreferences.indexOf( parentUnderlyingObjectType ) !== -1
            || parentObjectType === 'Fgf0PartitionElement' ) {
        return 'Awb0AddPartSibling';
    }// For SMM 0 Object

    return 'Awb0AddSiblingElementDeclarative';
};

/**
* Populate createInput for bulk object creation.
* @param {Object} sourceObjects - Part objects to be added
* @param {Object} data - declarative view model
* @param {Object} editHandler - editHandler
* @return {Object} bulk create input
*/
var populateBulkCreateInput = function( sourceObjects, data, editHandler ) {
    // Get the dummy CreateInput for RO
    var returnedInput = addObjectUtils.getCreateInput( data, '', data.createSubType, editHandler );
    var bulkCreateIn = [];
    for( var i = 0; i < sourceObjects.length; i++ ) {
        // Clone the createInput
        var tempCreateIn = _.cloneDeep( returnedInput[ 0 ] );

        //  Clear the ID field if exists.Let it be driven via auto-generated ID
        if( tempCreateIn.createData.compoundCreateInput.wso_thread !== undefined ) {
            tempCreateIn.createData.compoundCreateInput.wso_thread[ 0 ].propertyNameValues.fnd0ThreadId[ 0 ] = '';
        }

        //  Copy revision name
        //  Case 1 : User input for RO Name !='' and Part revision name !='' => Replace RO name by Part Revision name
        //  Case 2 : User input for RO Name =='' and Part revision name !='' => Add RO name same as Part Revision name
        if( tempCreateIn.createData.propertyNameValues.object_name !== undefined ) {
            tempCreateIn.createData.propertyNameValues.object_name[ 0 ] = sourceObjects[ i ].props.object_name.dbValues[ 0 ];
        } else {
            var objectName = [ sourceObjects[ i ].props.object_name.dbValues[ 0 ] ];
            _.set( tempCreateIn.createData.propertyNameValues, 'object_name', objectName );
        }

        //  Copy revision description if non null
        //  Case 1 : User input for RO Description !='' and Part revision description !='' => Replace RO desc by Part Revision desc
        //  Case 2 : User input for RO Description !='' and Part revision description =='' => Replace RO desc by Part Revision desc
        //  Case 3 : User input for RO Description =='' and Part revision description !='' => Add RO desc same as Part Revision desc
        if( tempCreateIn.createData.propertyNameValues.object_desc !== undefined && sourceObjects[ i ].props.object_desc.dbValues[ 0 ] !== null ) {
            tempCreateIn.createData.propertyNameValues.object_desc[ 0 ] = sourceObjects[ i ].props.object_desc.dbValues[ 0 ];
        } else if( tempCreateIn.createData.propertyNameValues.object_desc !== undefined && sourceObjects[ i ].props.object_desc.dbValues[ 0 ] === null ) {
            tempCreateIn.createData.propertyNameValues.object_desc[ 0 ] = '';
        } else if( tempCreateIn.createData.propertyNameValues.object_desc === undefined && sourceObjects[ i ].props.object_desc.dbValues[ 0 ] !== null ) {
            var objectDesc = [ sourceObjects[ i ].props.object_desc.dbValues[ 0 ] ];
            _.set( tempCreateIn.createData.propertyNameValues, 'object_desc', objectDesc );
        }

        bulkCreateIn.push( tempCreateIn.createData );
    }
    return bulkCreateIn;
};

/**
* Get input data for object creation.
* @param {Object} data - the view model data object
  @param {Array} sourceObjects - source object
* @param {Object} editHandler input
* @return {Object} create input
*/
export const getBulkCreateInput = function( data, sourceObjects, editHandler ) {
    //  Return createInput for RO, if it's a bulk create scenario
    var deferred = AwPromiseService.instance.defer();
    var returnedinput = null;
    if( sourceObjects !== undefined && sourceObjects.length > 1 ) {
        var uids = [];
        for( var i = 0; i < sourceObjects.length; i++ ) {
            if( sourceObjects[ i ].props.awb0Archetype !== undefined ) {
                // We got an Awb0Element as input
                sourceObjects[ i ] = cdmSvc.getObject( sourceObjects[ i ].props.awb0Archetype.dbValues[ 0 ] );
                uids.push( sourceObjects[ i ].uid );
            } else {
                uids.push( sourceObjects[ i ].uid );
            }
        }
        // Loading required properties for future use
        dmSvc.getProperties( uids, [ 'object_name', 'object_desc' ] ).then( function() {
            returnedinput = populateBulkCreateInput( sourceObjects, data, editHandler );
            deferred.resolve( returnedinput );
        } );
    }
    return deferred.promise;
};

/**
* Gets the created object from createRelateAndSubmitObjects SOA response. Returns ItemRev if the creation type
* is subtype of Item.
*
* @param {Object} response of createRelateAndSubmitObjects SOA call
* @return {Object} response
*/
export const getCreatedObject = function( response ) {
    return addObjectUtils.getCreatedObjects( response );
};


/**
* initializePanelProperties
* @function initializePanelProperties
* @param {Object} addPanelState - the view model data
* @return {Object} returns panel properties
*/
export const initializePanelProperties = function( addPanelState ) {
    //reset subtype
    const createSubType = addPanelState.creationType;

    //Reset number of elements
    const numberOfElements = {
        dbValue: 1
    };

    return{
        createSubType,
        numberOfElements
    };
};

const exports = {
    loadCreatedObjects,
    getRevisionData,
    getBulkCreateInput,
    getCreatedObject,
    initializePanelProperties,
    updateAddElementState,
    buildOccurrenceCreateInputAndUpdateState,
    addPartPanelSelection
};

export default exports;

