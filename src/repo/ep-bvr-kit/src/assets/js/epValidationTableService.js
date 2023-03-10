// Copyright (c) 2020 Siemens
/**
 * Service for validation results table view and details table views
 *
 * @module js/epValidationTableService
 */

import tableSvc from 'js/published/splmTablePublishedService';
import awTableService from 'js/awTableService';
import awColumnSvc from 'js/awColumnService';
import epLoadService from 'js/epLoadService';
import epLoadInputHelper from 'js/epLoadInputHelper';
import { constants as epLoadConstants } from 'js/epLoadConstants';
import viewModelObjectService from 'js/viewModelObjectService';
import epValidationContextService from 'js/epValidationContextService';
import epValidationCellRenderer from 'js/epValidationCellRenderer';
import appCtxService  from 'js/appCtxService';


const EP_VALIDATION_RESULTS = 'epValidationResults';
const EP_VALIDATION_INPUT = 'epValidationInput';
const EP_VALIDATION_INPUT_FOR_RUN = 'epValidationInputForRun';
const EP_VALIDATION_GET_NEW_RESULTS = 'epValidationGetNewResults';
const EP_VALIDATION_COLUMNS = 'epValidationColumns';
const EP_VALIDATION_RESULTS_AVAILABLE = 'epValidationResultsAvailable';

/**
  * Creates a property attribute
  * @param  {String}  input - the input object to be converted to property attribute form
  * @return {String} - the input object as a property attribute form
  */
function createPropAttr( input ) {
    return {
        type: 'STRING',
        isRequired: false,
        isEditable: false,
        dbValue: '',
        labelPosition: '',
        displayValue: input,
        uiValue: input,
        displayName: input,
        requiredText: input
    };
}

/**
  * Creates a validation table column
  * @param  {String}  columnName - the name of the column
  * @param  {Boolean}  render - true, add cell render
  * @param  {Number}  width - use if greater than zero, otherwise '*'
  * @return {Object} - an aw column
  */
function createColumn( columnName, render, width ) {
    let realWidth = '*';
    if( width > 0 ) {
        realWidth = width;
    }
    let column = awColumnSvc.createColumnInfo( {
        name: columnName,
        propertyName: columnName,
        typeName: 'ValidationColumnType',
        minWidth: 100,
        width: realWidth,
        enableFiltering: false,
        enableColumnResizing: true,
        enablePinning: false,
        enableSorting: false,
        enableCellEdit: false
    } );
    if( render ) {
        column.cellRenderers = [ cellRenderer() ];
    }
    return column;
}

/**
  * Build table columns for validation details table
  *
  * @param {Object} dataProvider - the table data provider
  * @param {Object} data - the table data
  * @param {Boolean} render - true to use cell rendering
  */
function createDetailColumns( dataProvider,  data, render ) {
    let tableColumns = [];
    let i = 0;
    for( let column in data.columns ) {
        if( !render && i === 2 ) {  // condition equals - Detail Table Message Column
            tableColumns.push( createColumn( data.columns[ column ], render, 1300 ) );
        } else {
            tableColumns.push( createColumn( data.columns[ column ], render, 0 ) );
        }
        i += 1;
    }

    dataProvider.columnConfig = {
        columns: tableColumns
    };
}
/**
  * Build table columns for validation results table
  *
  * @param {Object} relatedObjectsMap - the table data provided from server
  * @param {Object} dataProvider - the table data provider
  * @param {Object} columnInfo - the first two columns are fixed names
  */
function createColumns( relatedObjectsMap, dataProvider, columnInfo ) {
    // The first two columns are fixed:  Bomline and Summary
    let columnNames = columnInfo;

    // Get the Validation Test Names to use as columns
    let keys = Object.keys( relatedObjectsMap );
    const additionalProperties = relatedObjectsMap[ keys[ 0 ] ].additionalPropertiesMap2;
    for( let prop in additionalProperties ) {
        let propValueArray = additionalProperties[ prop ];
        columnNames.push( propValueArray[ 1 ] );
    }

    let data = { columns: columnNames };

    createDetailColumns( dataProvider, data, true );
}

/**
  * Finds model object by uid
  * @param  {Object}  modelObjects - array of model objects to search
  * @param  {Object}  uid - uid of object to find
  * @return {Object} - the model object matching input uid
  */
function getModelObjectByUid( modelObjects, uid ) {
    for( let object in modelObjects ) {
        let currentObject = modelObjects[ object ];
        if( uid === currentObject.uid ) {
            return currentObject;
        }
    }
}
/**
  * Message View passes process tree selection to context for Run Command
  * @param  {Object}  inputObject - the process tree selection
  */
function setInputObject( inputObject ) {
    epValidationContextService.setEpValidationContext( EP_VALIDATION_INPUT, { inputObject } );
}

/**
  * Creates validation results table data
  * @param  {Object}  dataProvider - the table dataProvider
  * @param  {Object}  data - object to pass column info
  * @return {Object} - the table row contents
  */
function getColumnsData( dataProvider, data ) {
    // get the server results from the context

    const epValidationContext = epValidationContextService.getEpValidationContext();
    const validationResults = epValidationContext[ EP_VALIDATION_RESULTS ];
    const testedObjects = validationResults.relatedObjects;
    const testedModelObjects = validationResults.loadedObjects.mfgValidationResults;
    createColumns( testedObjects, dataProvider, data.columns );
    let columnNames = [];
    const columnInfoArray = dataProvider.columnConfig.columns;
    for( let columnInfoEntry in columnInfoArray ) {
        columnNames.push( columnInfoArray[ columnInfoEntry ].propertyName );
    }

    epValidationContextService.setEpValidationContext( EP_VALIDATION_COLUMNS, columnNames );
    // create the table data by row
    let rowsObjects = [];
    for( let testedObject in testedObjects ) {
        let rowValues = []; // columns: bomline,summary,test1...testn
        // the additional properties has the validation test results per tested object
        const additionalProperties = testedObjects[ testedObject ].additionalPropertiesMap2;
        let vmo = viewModelObjectService.constructViewModelObjectFromModelObject( testedObject );
        vmo.uid = testedObject;
        const modelObject = getModelObjectByUid( testedModelObjects, vmo.uid );
        const objectName = modelObject.props.object_string.uiValues[ 0 ];
        rowValues.push( createPropAttr( objectName ) ); // BOMLine column value

        // collect the validation test pass/fail status from context data
        let summary = 'Pass';
        for( let prop in additionalProperties ) {
            let propValueArray = additionalProperties[ prop ];
            rowValues.push( createPropAttr( propValueArray[ 2 ] ) );
            if( propValueArray[ 2 ] === 'Fail' ) {
                summary = 'Fail';
            }
        }
        // now populate the vmo prop column data with the row value data
        vmo.props[ columnNames[ 0 ] ] = rowValues[ 0 ];
        vmo.props[ columnNames[ 1 ] ] = createPropAttr( summary );
        for( let j = 2; j < columnNames.length; j++ ) {
            vmo.props[ columnNames[ j ] ] = rowValues[ j - 1 ];
        }
        rowsObjects.push( vmo );
    }
    // To fix validation results showing packed lines with quantity
    const BOMLineValues = new Set();
    for( let rowsObject in rowsObjects ) {
        BOMLineValues.add( rowsObjects[rowsObject].props['BOM Line'].displayValue );
    }

    for( let rowsObject in rowsObjects ) {
        let val = String( rowsObjects[rowsObject].props['BOM Line'].displayValue );
        for( let i of BOMLineValues.values() ) {
            if( val.includes( i ) && val !== i ) {
                rowsObjects[rowsObject].props['BOM Line'].displayValue = i;
                rowsObjects[rowsObject].props['BOM Line'].uiValue = i;
                rowsObjects[rowsObject].props['BOM Line'].displayName = i;
                rowsObjects[rowsObject].props['BOM Line'].requiredText = i;
            }
        }
    }

    const totalRows = Object.keys( rowsObjects ).length;

    return {
        rowsObjects,
        totalRows
    };
}
/**
  * Creates validation results detail table data
  * @param  {String}  selectedObject - the decl view model of the object selected in results table
  * @param  {Object}  dataProvider - the table dataProvider
  * @return {Object} - the table row contents
  */
function getDetailColumnsData( selectedObject, dataProvider ) {
    const epValidationContext = epValidationContextService.getEpValidationContext();
    const validationResults = epValidationContext[ EP_VALIDATION_RESULTS ];
    const testedObjects = validationResults.relatedObjects;
    // collect column info : Test Name, Message Type , Message
    const columnNames = [];
    let columnInfoArray = dataProvider.columnConfig.columns;
    for( let columnInfoEntry in columnInfoArray ) {
        columnNames.push( columnInfoArray[ columnInfoEntry ].propertyName );
    }
    let rowsObjects = [];
    // find the selectedObject in the context data so we can get the validation message information
    for( let testedObject in testedObjects ) {
        if( selectedObject[ 0 ].uid === testedObject ) {
            const additionalProperties = testedObjects[ testedObject ].additionalPropertiesMap2;
            // There will be a message for each validation test
            for( let prop in additionalProperties ) {
                let vmo = viewModelObjectService.constructViewModelObjectFromModelObject( selectedObject[ 0 ] );
                vmo.uid = testedObject;
                let propValueArray = additionalProperties[ prop ];
                vmo.props = [];
                // validation result message information
                vmo.props[ columnNames[ 0 ] ] = createPropAttr( propValueArray[ 1 ] );
                vmo.props[ columnNames[ 1 ] ] = createPropAttr( propValueArray[ 3 ] );
                vmo.props[ columnNames[ 2 ] ] = createPropAttr( propValueArray[ 4 ] );
                rowsObjects.push( vmo );
            }
        }
    }
    const totalRows = Object.keys( rowsObjects ).length;
    let loadResult = awTableService.createTableLoadResult( totalRows );
    loadResult.searchResults = rowsObjects;
    loadResult.totalFound = 0;
    return loadResult;
}
/**
  * Table Cell Renderer for PL Table
  * @return {Object} - cell content
  */
const cellRenderer = function() {
    return {
        action: function( column, vmo, tableElem, rowElem ) {
            if( column.index === 0 ) {
                return;
            }
            const cellContent = tableSvc.createElement( column, vmo, tableElem, rowElem );
            return epValidationCellRenderer.validationStatusRenderer( vmo, cellContent, column.field );
        },
        condition: function( column, vmo, tableElem, rowElem ) {
            return true;
        }
    };
};
/**
  * Run validation checks
  *
  * @param {String} data - the object uid to load its related data to display in table
  * @return {null}  - returns if invalid objUid
  * TODO:  change this to take selected lines from the Process Tree
  */
function runValidationChecks( addLoadParams ) {
    const objUids = [];
    const epValidationContext = epValidationContextService.getEpValidationContext();
    const validationInputs = epValidationContext[ EP_VALIDATION_INPUT ].inputObject;
    epValidationContextService.clearContext();
    epValidationContextService.setEpValidationContext( EP_VALIDATION_GET_NEW_RESULTS, false );
    epValidationContextService.setEpValidationContext( EP_VALIDATION_RESULTS_AVAILABLE, false );
    for( let object in validationInputs ) {
        objUids.push( validationInputs[ object ].uid );
    }

    const loadtypeInput = epLoadInputHelper.getLoadTypeInputs( epLoadConstants.MFG_VALIDATIONS, objUids, '', '', addLoadParams );
    appCtxService.updatePartialCtx( 'epValidationContext.epValidationInputForRun', validationInputs );
    return epLoadService.loadObject( loadtypeInput, false ).then(
        function( response ) {
            if( response.ServiceData ) {
                let loadedObjects = response.loadedObjectsMap;
                let relatedObjects = response.relatedObjectsMap;
                epValidationContextService.setEpValidationContext( EP_VALIDATION_RESULTS, { loadedObjects, relatedObjects } );
                epValidationContextService.setEpValidationContext( EP_VALIDATION_GET_NEW_RESULTS, false );
            }
        }
    ).then( () => appCtxService.updatePartialCtx( 'epValidationContext.epValidationResultsAvailable', true ) );
}
export function updateDataToTable( selection ) {
    const initData = {};
    initData.selection = selection;
    initData.title = {
        dispValue : selection[0].props['BOM Line'].displayValue
    };
    return initData;
}
export default {
    setInputObject,
    getColumnsData,
    getDetailColumnsData,
    createDetailColumns,
    runValidationChecks,
    updateDataToTable
};


