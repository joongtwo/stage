// Copyright (c) 2022 Siemens

/**
 * @module js/insertElementService
 */
import appCtxService from 'js/appCtxService';
import uwPropertyService from 'js/uwPropertyService';
import viewModelObjectService from 'js/viewModelObjectService';
import localeService from 'js/localeService';
import _ from 'lodash';
import awTableService from 'js/awTableService';
import addElemService from 'js/addElementService';
import cdm from 'soa/kernel/clientDataModel';
import occStructureEditSvc from 'js/occmgmtStructureEditService';
import occmgmtSplitViewUpdateService from 'js/occmgmtSplitViewUpdateService';

var exports = {};

/**
 * Get the localized value from a given key.
 * @param {String} key: The key for which the value needs to be extracted.
 * @return {String} localized string for the input key.
 */
function getLocalizedValueFromKey( key ) {
    var resource = 'OccurrenceManagementConstants';
    var localTextBundle = localeService.getLoadedText( resource );
    return localTextBundle[ key ];
}

/**
 * Populate input for addElement.elementsAdded event, to be called for inserted element added under current parent
 * @param {DeclViewModel} data - Awb0InsertLevelSubPanelViewModel
 */
function populateElementToBeAddedUnderCurrentParent( data ) {
    //populate addElementResponse for old parent -> don't add newElementInfo
    var oldParentElement = cdm.getObject( appCtxService.ctx.aceActiveContext.context.insertLevelInput.currentParentElement );
    var selectedNewElementInfoForOldParent = {};
    selectedNewElementInfoForOldParent.newElements = [ data.insertElementResponse.newParent ];
    var parentElemsInResponse = data.insertElementResponse.childOccurrencesInfo[0];
    var childOccurences = data.insertElementResponse.childOccurrencesInfo[1];
    var parentIdx = _.findLastIndex( parentElemsInResponse, function( parentElem ) {
        return parentElem.uid === appCtxService.ctx.aceActiveContext.context.insertLevelInput.currentParentElement;
    } );
    selectedNewElementInfoForOldParent.pagedOccurrencesInfo = {
        childOccurrences: childOccurences[parentIdx]
    };

    var addElementResponseForOldParent =  {
        selectedNewElementInfo: selectedNewElementInfoForOldParent,
        ServiceData: data.insertElementResponse.ServiceData
    };
    return { oldParentElement, addElementResponseForOldParent };
}

/**
 * Populate input for addElement.elementsAdded event, to be called for selected elements added under inserted parent
 * @param {DeclViewModel} data - Awb0InsertLevelSubPanelViewModel
 */
function populateElementsToBeAddedUnderNewParent( data ) {
    //populate addElementResponse for new parents -> also add newElementInfo
    var newParent =  data.insertElementResponse.newParent;
    var selectedNewElementInfoForNewParent = {
        newElements:[]
    };
    var parentElemsInResponse = data.insertElementResponse.childOccurrencesInfo[0];
    var childOccurences = data.insertElementResponse.childOccurrencesInfo[1];
    var childInx = _.findLastIndex( parentElemsInResponse, function( parentElem ) {
        return parentElem.uid === data.insertElementResponse.newParent.uid;
    } );
    selectedNewElementInfoForNewParent.pagedOccurrencesInfo = {
        childOccurrences: childOccurences[childInx]
    };

    for( var inx = 0; inx < data.insertElementResponse.ServiceData.created.length; inx++ ) {
        var childOccInx = _.findLastIndex( childOccurences[childInx], function( childOccurrence ) {
            return childOccurrence.occurrenceId === data.insertElementResponse.ServiceData.created[inx];
        } );
        if( childOccInx > -1 ) {
            var newElement = cdm.getObject( data.insertElementResponse.ServiceData.created[inx] );
            selectedNewElementInfoForNewParent.newElements.push( newElement );
        }
    }

    var addElementResponseForNewParent = {
        selectedNewElementInfo: selectedNewElementInfoForNewParent,
        newElementInfos: data.insertElementResponse.newElementInfos,
        ServiceData: data.insertElementResponse.ServiceData
    };
    return { newParent, addElementResponseForNewParent };
}

/**
 * Populate table data for selectedElements table
 * @return {Object} loadResult - table data
 */
export let loadInsertLevelTableData = function() {
    var rowLength = appCtxService.ctx.aceActiveContext.context.insertLevelInput.selectedElements.length;
    var vmRows = [];
    for( var rowIndx = 0; rowIndx < rowLength; rowIndx++ ) {
        var currentSelection = appCtxService.ctx.aceActiveContext.context.insertLevelInput.selectedElements[rowIndx];
        var dbValue = currentSelection.props.object_string.dbValues[ 0 ];
        var displayValues = [ dbValue ];
        var localizedName = getLocalizedValueFromKey( 'Name' );
        var vmProp = uwPropertyService.createViewModelProperty( 'Name', localizedName, 'OBJECT', dbValue, displayValues );
        var constMap = {
            ReferencedTypeName: 'ItemRevision'
        };
        var propApi = {
            showAddObject: false
        };
        vmProp.propertyDescriptor = {
            displayName: localizedName,
            constantsMap: constMap
        };
        vmProp.propApi = propApi;
        vmProp.isEditable = true;
        vmProp.editableInViewModel = true;
        var vmRow = {};
        vmRow.props = {};
        vmRow.props.Name = vmProp;
        vmRow.editableInViewModel = true;
        vmRow.isModifiable = true;
        vmRow.editableInViewModel = true;
        vmRow.typeIconURL = currentSelection.typeIconURL;
        uwPropertyService.setEditable( vmRow.props.Name, true );
        uwPropertyService.setEditState( vmRow, true );
        vmRows.push( vmRow );
    }
    var loadResult = awTableService.createTableLoadResult( vmRows.length );
    loadResult.selectedElems = vmRows;
    loadResult.totalSelectedElems = vmRows.length;
    return loadResult;
};

/**
 * Populate allowed types information for selected elements for insert level operation
 * @param {Object} response - getInfoForInsertLevel SOA Response
 */
export let extractAllowedTypesInfoFromResponse = function( response ) {
    if ( response.preferredTypeInfo ) {
        response.preferredExists = true;
    }
    var allowedTypesInfo = addElemService.extractAllowedTypesInfoFromResponse( response );
    if ( appCtxService.ctx.aceActiveContext.context.insertLevelInput ) {
        appCtxService.updatePartialCtx( 'aceActiveContext.context.insertLevelInput.allowedTypesInfo', allowedTypesInfo );
    } else {
        var insertLevelInput = {
            allowedTypesInfo: allowedTypesInfo
        };
        appCtxService.updatePartialCtx( 'aceActiveContext.context.insertLevelInput', insertLevelInput );
    }
};

/**
 * Populate insert level input information and store in context
 * @return {Object} selectedElements - selected elements to be sent as input to getInfoForInsertLevel SOA
 */
export let populateInsertLevelInputInformation = function( occContext ) {
    var selectedElements = occContext.selectedModelObjects;

    var insertLevelInput = {};

    insertLevelInput.selectedElements = [];
    _.forEach( selectedElements, function( selectedModelObject ) {
        var selectedVMO = viewModelObjectService.createViewModelObject( selectedModelObject.uid );
        insertLevelInput.selectedElements.push( selectedVMO );
    } );

    insertLevelInput.currentParentElement = selectedElements[0].props.awb0Parent.dbValues[0];
    appCtxService.ctx.aceActiveContext = appCtxService.ctx.aceActiveContext || {
        context: {}
    };
    appCtxService.updatePartialCtx( 'aceActiveContext.context.insertLevelInput', insertLevelInput );
    return insertLevelInput.selectedElements;
};

/**
 * Delete insert level input from context once Insert level panel is closed
 */
export let clearInsertLevelInputFromCtx = function() {
    if( appCtxService.ctx.aceActiveContext.context.insertLevelInput ) {
        appCtxService.updatePartialCtx( 'aceActiveContext.context.insertLevelInput', undefined );
    }
};

/**
 * Populate input for addElement.elementsAdded event
 * @param {DeclViewModel} data - Awb0InsertLevelSubPanelViewModel
 */
export let elementsInserted = function( data ) {
    if( appCtxService.ctx.aceActiveContext.context.insertLevelInput ) {
        var inactiveView = occmgmtSplitViewUpdateService.getInactiveViewKey();
        if( inactiveView ) {
            occStructureEditSvc.deSelectFromInactiveView( appCtxService.ctx.aceActiveContext.context.insertLevelInput.selectedElements, inactiveView );
        }
        //1. populate addElementResponse for old parent -> don't add newElementInfo
        var addUnderCurrentParent = populateElementToBeAddedUnderCurrentParent( data );

        //2. populate addElementResponse for new parents -> also add newElementInfo
        var addUnderNewParent = populateElementsToBeAddedUnderNewParent( data );
        return { ...addUnderCurrentParent, ...addUnderNewParent };
    }
};

/**
 * Populate input for insertLevel SOA
 * @param {DeclViewModel} data - Awb0InsertLevelSubPanelViewModel
 * @return {Object} objectToBeInserted - object to be inserted as parent for the selected elements
 */
export let getParentElementToInsertLevel = function( data, createdObject, sourceObjects ) {
    if ( Array.isArray( createdObject ) ) {
        return cdm.getObject( createdObject[ 0 ].props.items_tag.dbValues[ 0 ] );
    } else if ( createdObject ) {
        return cdm.getObject( createdObject.props.items_tag.dbValues[ 0 ] );
    }
    return sourceObjects[0];
};

/**
 * Insert Element service
 */
export default exports = {
    loadInsertLevelTableData,
    extractAllowedTypesInfoFromResponse,
    populateInsertLevelInputInformation,
    clearInsertLevelInputFromCtx,
    elementsInserted,
    getParentElementToInsertLevel
};
