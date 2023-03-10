// @<COPYRIGHT>@
// ==================================================
// Copyright 2018.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 * @module js/workinstrTableService
 */
import awColumnSvc from 'js/awColumnService';
import AwPromiseService from 'js/awPromiseService';
import _ from 'lodash';


/**
 * loadData - get the rows of data to display in the table
 *
 * @param {Object} activeTab the current tab
 * @param {StringArray} sortCriteria the columns sort criteria
 *
 * @return {Object} searchResults - the data to display in the table rows
 * totalFound - the total number of rows to display in the table
 */
export function loadData( activeTab, sortCriteria ) {
    let deferred = AwPromiseService.instance.defer();

    let searchResults;
    if( sortCriteria && sortCriteria[ 0 ] ) {
        var sortColumn = sortCriteria[ 0 ].fieldName;
        searchResults = _.sortBy( activeTab.datasetsToShow, function( modelObj ) {
            return modelObj.props[ sortColumn ].dbValues[ 0 ];
        } );
        if( sortCriteria[ 0 ].sortDirection === 'DESC' ) {
            searchResults.reverse();
        }
    } else {
        searchResults = activeTab.datasetsToShow;
    }

    deferred.resolve( {
        searchResults: searchResults,
        totalFound: activeTab.datasetsToShow.length
    } );

    return deferred.promise;
}

/**
 * loadColumns - get table columns
 *
 * @param {Object} dataProvider the table data provide
 * @param {Object} colInfos the table columns info
 *
 * @return {Object} columnInfos - a list of the table columns info
 */
export function loadColumns( dataProvider, colInfos ) {
    dataProvider.columnConfig = {
        columns: colInfos
    };

    let deferred = AwPromiseService.instance.defer();

    deferred.resolve( {
        columnInfos: colInfos
    } );

    return deferred.promise;
}

/**
 * Build table columns and the columns property policy from the passed in object properties
 *
 * @param {ObjectArray} tableColumns each table column data
 * @param {StringArray} objProperties each object property in the list to add to the policy and displayed as a column
 * @param {String} objType the object type to get its properties
 *
 * @return {ObjectArray} property policy for all table columns
 */
export function getColumns( tableColumns, objProperties, objType ) {
    let propPolicy = {
        types: []
    };

    let properties = [];

    propPolicy.types.push( {
        name: objType,
        properties: properties
    } );

    for( let indx in objProperties ) {
        properties.push( {
            name: objProperties[ indx ]
        } );

        tableColumns.push( awColumnSvc.createColumnInfo( {
            name: objProperties[ indx ],
            propertyName: objProperties[ indx ],
            typeName: objType,
            minWidth: 100,
            width: '*',
            isFilteringEnabled: false,
            enableColumnResizing: true,
            enablePinning: false,
            enableSorting: true,
            enableCellEdit: false
        } ) );
    }

    return propPolicy;
}

/**
 * Build the property policy from the passed in object properties
 *
 * @param {StringArray} objProperties each object property in the list to add to the policy and displayed as a table column
 * @param {String} objType the object type to get its properties
 *
 * @return {ObjectArray} property policy for all table columns
 */
export function getColumnsPolicy( objProperties, objType ) {
    let propPolicy = {
        types: []
    };

    let properties = [];

    propPolicy.types.push( {
        name: objType,
        properties: properties
    } );

    for( var indx in objProperties ) {
        properties.push( {
            name: objProperties[ indx ]
        } );
    }

    return propPolicy;
}

/**
 * Build table columns from the passed in object properties
 *
 * @param {ObjectArray} tableColumns each table column data
 * @param {StringArray} objProperties each object property in the list to add to the policy and displayed as a column
 * @param {String} objType the object type to get its properties
 */
export function createColumns( tableColumns, objProperties, objType ) {
    for( let indx in objProperties ) {
        tableColumns.push( awColumnSvc.createColumnInfo( {
            name: objProperties[ indx ],
            propertyName: objProperties[ indx ],
            typeName: objType,
            minWidth: 100,
            width: '*',
            enableFiltering: false,
            enableColumnResizing: true,
            enablePinning: false,
            enableSorting: true,
            enableCellEdit: false
        } ) );
    }
    return tableColumns;
}

/**
 * Change the view mode from table to list or vice versa
 *
 * @param {Object} viewerData the viewer data
 * @param {String} newViewMode the view mode to switch to
 */
export function changeViewMode( viewerData, newViewMode ) {
    const tempViewerDataTabModel = viewerData.tabModel;
    const currentMode = viewerData.tabModel.viewMode.tableMode;
    if( currentMode === 'table' && newViewMode === 'list' ) {
        tempViewerDataTabModel.viewMode.tableMode = 'list';
        tempViewerDataTabModel.viewName = viewerData.tabModel.viewMode.listView;
    } else if( currentMode === 'list' && newViewMode === 'table' ) {
        tempViewerDataTabModel.viewMode.tableMode = 'table';
        tempViewerDataTabModel.viewName = viewerData.tabModel.viewMode.tableView;
    }
    viewerData.tabModel.update( tempViewerDataTabModel );
}

let exports;
export default exports = {
    loadData,
    loadColumns,
    getColumns,
    getColumnsPolicy,
    createColumns,
    changeViewMode
};
