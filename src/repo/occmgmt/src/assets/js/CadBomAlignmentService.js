// Copyright (c) 2022 Siemens

/**
 * @module js/CadBomAlignmentService
 */
import AwPromiseService from 'js/awPromiseService';
import cdm from 'soa/kernel/clientDataModel';
import ClipboardService from 'js/clipboardService';
import adapterSvc from 'js/adapterService';
import appCtxSvc from 'js/appCtxService';
import viewModelObjectService from 'js/viewModelObjectService';
import eventBus from 'js/eventBus';
import CadBomAlignmentUtil from 'js/CadBomAlignmentUtil';
import cbaRefreshObjectsService from 'js/cbaRefreshObjectsService';
import cbaObjectTypeService from 'js/cbaObjectTypeService';
import cbaConstants from 'js/cbaConstants';

/**
 * Create relation object with primary and secondary object with given relation type.
 * @param {Object} primaryObject - Primary object
 * @param {Object} secondaryObject - Secondary object
 * @param {string} relationType - Relation type
 * @returns {object} - Returns created relation object
 */
let createRelationObject = function( primaryObject, secondaryObject, relationType ) {
    let relationObject = {
        clientId: '',
        userData: {
            uid: 'AAAAAAAAAAAAAA',
            type: 'unknownType'
        }
    };

    relationObject.primaryObject = {};
    relationObject.primaryObject.uid = primaryObject.uid;
    relationObject.primaryObject.type = primaryObject.type;

    relationObject.secondaryObject = {};
    relationObject.secondaryObject.uid = secondaryObject.uid;
    relationObject.secondaryObject.type = secondaryObject.type;

    relationObject.relationType = relationType;

    return relationObject;
};

/**
 * Create relation object with primary and secondary objects with given relation type.
 * @param {Object} primaryObject - Primary object
 * @param {Object} secondaryObjects - Collection of secondary objects
 * @param {string} relationType - Relation type
 * @param {boolean} useXRTSecondaryAsRelationPrimary - Use XRT secondary selected objects as primary in relation.
 * @returns {object} - Returns list of relation objects
 */
let createRelationObjects = function( primaryObject, secondaryObjects, relationType, useXRTSecondaryAsRelationPrimary ) {
    let relationObjects = [];
    for( let itr = 0, len = secondaryObjects.length; itr < len; ++itr ) {
        if( useXRTSecondaryAsRelationPrimary === true ) {
            relationObjects.push( createRelationObject( secondaryObjects[ itr ], primaryObject, relationType ) );
        } else {
            relationObjects.push( createRelationObject( primaryObject, secondaryObjects[ itr ], relationType ) );
        }
    }
    return relationObjects;
};

/**
 * Update primary selection from selected object.
 * @param {Object} data - Declarative view model object
 * @param {Object} occContext - occContext object
 * @returns {object} - Returns promise
 */
let updatePrimarySelectionFromSelectedObject = function( data, occContext ) {
    let deferred = AwPromiseService.instance.defer();
    let selectedUid = CadBomAlignmentUtil.getPrimarySelection( occContext ).uid;
    let selected = cdm.getObject( selectedUid );
    data.primarySelection = selected;
    let targetObjs = [];

    if( selected && selected.props && selected.props.awb0Archetype !== undefined ) {
        let sourceObj = cdm.getObject( selected.props.awb0Archetype.dbValues[ 0 ] );
        targetObjs.push( sourceObj );
    } else {
        targetObjs.push( selected );
    }

    let adaptedObjects = adapterSvc.getAdaptedObjectsSync( targetObjs );
    if( viewModelObjectService.isViewModelObject( adaptedObjects[ 0 ] ) ) {
        data.selectedObject = adaptedObjects[ 0 ];
    } else {
        data.selectedObject = viewModelObjectService.constructViewModelObjectFromModelObject( adaptedObjects[ 0 ], 'EDIT' );
    }
};



/**
 * Align selected objects as designs
 * @param {Object} data - Declarative view model object
 * @param {Object} useXRTSecondaryAsRelationPrimary - useXRTSecondaryAsRelationPrimary
 * @param {Object} sourceObjectsIn -source objects in
 * @param {Object} occContext - occContext object
 */
 export let alignSelectedObjects = function( data, useXRTSecondaryAsRelationPrimary, sourceObjectsIn, occContext ) {
     updatePrimarySelectionFromSelectedObject( data, occContext );

     let sourceObjects = [];

     if ( typeof data.createdMainObject === 'undefined' || data.createdMainObject === null ) {
         sourceObjects = sourceObjectsIn;
     } else {
         sourceObjects.push( data.createdObjects[ 0 ] );
     }

     let createInputList = createRelationObjects( data.selectedObject, sourceObjects, 'TC_Is_Represented_By', data.useXRTSecondaryAsRelationPrimary );
     eventBus.publish( 'alignSelectedObjects', createInputList );
  
};

/**
 * Get input object for un-align operation
 * @param {Object} dataObj - Declarative view model object
 * @param {Object} occContext - occContext object
 * @returns {object} - Returns list of relation object.
 */
export let getRemoveInput = function( dataObj, occContext ) {
    return exports.getSoaInput( dataObj, 'TC_Is_Represented_By', true, false, occContext );
};

/**
 * Get input object for un-align operation
 * @param {Object} dataObj - Declarative view model object
 * @param {string} useXRTSecondaryAsRelationPrimary - Use XRT secondary selected objects as primary in relation.
 * @param {Object} occContext - occContext object
 * @returns {object} - Returns list of relation object.
 */
export let getRemovePartInput = function( dataObj, useXRTSecondaryAsRelationPrimary, occContext ) {
    // This will be called from Json hence String "true"
    return exports.getSoaInput( dataObj, 'TC_Is_Represented_By', true, useXRTSecondaryAsRelationPrimary === 'true', occContext );
};

/**
 * Get input object for un-align operation
 * @param {Object} dataObj - Declarative view model object
 * @param {Object} occContext - occContext object
 * @returns {object} - Returns list of relation object.
 */
export let getSetPrimaryInput = function( dataObj, occContext ) {
    return exports.getSoaInput( dataObj, 'TC_Primary_Design_Representation', false, false, occContext );
};

/**
 * Get input object for paste operation
 * @param {Object} dataObj - Declarative view model object
 * @param {Object} occContext - occContext object
 * @param {Object} clipBoardInput - input from clipboard
 * @returns {object} - Returns list of relation object to paste
 */
export let getPasteInput = function( data, occContext, clipBoardInput ) {
    updatePrimarySelectionFromSelectedObject( data, occContext );
    let primaryQualifierType = cbaObjectTypeService.getObjectQualifierType( data.selectedObject );
    let secondaryQualifierType = cbaObjectTypeService.getObjectsQualifierType( clipBoardInput );

    let typeKeyToConstantMap = {};
    typeKeyToConstantMap[ cbaConstants.DESIGN ] = cbaConstants.PART;
    typeKeyToConstantMap[ cbaConstants.PART ] = cbaConstants.DESIGN;

    let secondaryObjects = secondaryQualifierType[ typeKeyToConstantMap[ primaryQualifierType ] ];
    let secondaryAdaptedObjects = adapterSvc.getAdaptedObjectsSync( secondaryObjects );

    let useXRTSecondaryAsRelationPrimary = primaryQualifierType === cbaConstants.DESIGN ? true : false;

    return createRelationObjects( data.selectedObject, secondaryAdaptedObjects, 'TC_Is_Represented_By', useXRTSecondaryAsRelationPrimary );
};

/**
 * Get input object for set primary operation
 * @param {Object} dataObj - Declarative view model object
 * @param {string} relationType - The relation type to create Relation object
 * @param {boolean} addToClipboard - true to add selected secondary object to clipboard else false
 * @param {boolean} useXRTSecondaryAsRelationPrimary - Use XRT secondary selected objects as primary in relation.
 * @param {Object} occContext - occContext object
 * @returns {object} - Returns list of relation object.
 */
export let getSoaInput = function( dataObj, relationType, addToClipboard, useXRTSecondaryAsRelationPrimary, occContext ) {
    let selectedPrimaryObject = CadBomAlignmentUtil.getPrimarySelection( occContext );
    let selectedPrimaryUid = selectedPrimaryObject.uid;

    dataObj.primarySelection = cdm.getObject( selectedPrimaryUid );
    let selectedSecondaryObjects = appCtxSvc.ctx.mselected;

    if( selectedPrimaryObject && selectedPrimaryObject.props && selectedPrimaryObject.props.awb0Archetype !== undefined ) {
        let sourceObj = cdm.getObject( selectedPrimaryObject.props.awb0Archetype.dbValues[ 0 ] );
        selectedPrimaryObject = sourceObj;
    }

    let primaryAdaptedObjs = adapterSvc.getAdaptedObjectsSync( [ selectedPrimaryObject ] );

    let adaptedObjs = adapterSvc.getAdaptedObjectsSync( selectedSecondaryObjects );
    // Add removed designs to clipboard
    if( addToClipboard === true ) {
        ClipboardService.instance.setContents( adaptedObjs );
    }
    return createRelationObjects( primaryAdaptedObjs[ 0 ], adaptedObjs, relationType, useXRTSecondaryAsRelationPrimary );
};

/**
 * Get input for refresh object SOA
 * @param {Array} primarySelection - Primary elements list
 * @param {Array} secondarySelection - Secondary elements list
 * @returns {Array} - List of elements to refresh
 */
export let getRefreshObjectsInput = function( primarySelection, secondarySelection ) {
    return cbaRefreshObjectsService.getElementsToRefresh( primarySelection, secondarySelection );
};

/**
 * Create Top nodes alignment input for passing it to createObject/deleteObject SOA
 * @param trgTop target top revison object
 * @param srcTop source top revision object
 * @returns {Array} The list of alignment input object
 */
export let getTopAlignmentInput = function( trgTop, srcTop ) {
    let alignmentInput = [ {
        primaryObject: trgTop,
        secondaryObject: srcTop,
        relationType: cbaConstants.ALIGNMENT_RELATION_PART_EBOM
    } ];
    let trgTopQualifierType = cbaObjectTypeService.getObjectQualifierType( trgTop );
    if( cbaConstants.PRODUCT_EBOM === trgTopQualifierType ) {
        alignmentInput = [ {
            primaryObject: cdm.getObject( trgTop.props.items_tag.dbValues[ 0 ] ),
            secondaryObject: cdm.getObject( srcTop.props.items_tag.dbValues[ 0 ] ),
            relationType: cbaConstants.ALIGNMENT_RELATION_PRODUCT_EBOM
        } ];
    }
    return alignmentInput;
};

/**
 * CAD-BOM Alignment service
 * @param {$q} $q - Service to use.
 * @param {soa_kernel_clientDataModel} cdm - Service to use
 * @param {clipboardService} clipboardSvc - Service to use
 * @param {adapterService} adapterSvc - Service to use
 * @param {appCtxService} appCtxSvc - Service to use
 * @param {viewModelObjectService} viewModelObjectService - Service to use
 * @returns {object} - object
 */

const exports = {
    alignSelectedObjects,
    getRemoveInput,
    getRemovePartInput,
    getSetPrimaryInput,
    getSoaInput,
    getRefreshObjectsInput,
    getTopAlignmentInput,
    getPasteInput
};
export default exports;
