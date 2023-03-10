// Copyright (c) 2022 Siemens

/**
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/showReportBuilderReportsService
 */
import appCtxService from 'js/appCtxService';
import _ from 'lodash';
import reportCommnSrvc from 'js/reportsCommonService';
import cmdPanelSrvc from 'js/commandPanel.service';

var exports = {};

export let getReportDefinitionVal = function( response, searchData, preferenceName ) {
    if( appCtxService.ctx.chartProvider ) {
        delete appCtxService.ctx.chartProvider;
    }
    var reportDefinitions = response.reportdefinitions.map( function( rDef ) {
        return response.ServiceData.modelObjects[ rDef.reportdefinition.uid ];
    } ).filter( function( rd ) {
        return rd.props.rd_class.dbValues[ 0 ] === '' || rd.props.rd_class.dbValues[0] !== '' && rd.props.rd_type.dbValues[0] === '1' && rd.props.rd_source.dbValues[0] === 'Active Workspace';
    } );

    const userObj = appCtxService.getCtx( 'user' );
    const userName = userObj.uid;

    var owningUserList = reportDefinitions.filter( function( rdList ) {
        return rdList.props.owning_user.dbValues[0] === userName;
    } );

    owningUserList = _.sortBy( owningUserList,  function( rDef ) {
        return rDef.props.creation_date.dbValues[ 0 ];
    } ).reverse();

    var otherUserList = reportDefinitions.filter( function( rdList ) {
        return rdList.props.owning_user.dbValues[0] !== userName;
    } );

    otherUserList = _.sortBy( otherUserList,  function( rDef ) {
        return rDef.props.rd_name.dbValues[ 0 ];
    } );
    var finalList = owningUserList.concat( otherUserList );
    reportDefinitions = finalList;

    reportCommnSrvc.setupReportPersistCtx( preferenceName );

    if( searchData ) {
        let newSearchData = searchData.getValue();
        newSearchData.totalFound = reportDefinitions.length;
        searchData.update( newSearchData );
    }

    return {
        reportdefinitions: reportDefinitions
    };
};

let displaySummaryCustomReportPanel = function( ctx, selectedReport ) {
    if( ctx.activeToolsAndInfoCommand === undefined ) {
        cmdPanelSrvc.activateCommandPanel( 'Awp0ReportsSummary', 'aw_toolsAndInfo', selectedReport );
    }
};

export let performSelectionAndRunReport = ( selectionModel, selectedReport, ctx ) => {
    selectionModel.setSelection( selectedReport.uid );
    appCtxService.updatePartialCtx( 'selected', selectedReport );
    displaySummaryCustomReportPanel( ctx, selectedReport );
};

/**
 * Load the column configuration
 *
 * @param {Object} dataprovider - the data provider
 */
export let loadColumns = function( dataprovider ) {
    dataprovider.columnConfig = {
        columns: [ {
            name: 'rd_name',
            displayName: 'Name',
            typeName: 'ReportDefinition',
            width: 300,
            enableColumnMoving: false,
            enableColumnResizing: false,
            enableFiltering: false,
            pinnedLeft: true
        }, {
            name: 'rd_id',
            displayName: 'Id',
            typeName: 'ReportDefinition',
            width: 300
        }, {
            name: 'rd_description',
            displayName: 'Description',
            typeName: 'ReportDefinition',
            width: 300
        } ]
    };
};

/**
 * Update dataProvider when search filter is updated
 *
 * @param {Object} searchData - for searchString and count of total templates found
 * @param {Object} searchResults - list of report templates
 * @param {Object} dataProvider - the data provider
 */

export let updateDataProvider = function( searchData, searchResults, dataProvider ) {
    if( searchResults && searchData.criteria.searchString !== undefined && searchData.criteria.searchString !== null && searchData.criteria.searchString !== '*' && searchData.criteria.searchString !== '' ) {
        var filterResults = [];
        var cnt = 0;

        for( var i = 0; i < searchResults.reportdefinitions.length; i++ ) {
            if( searchResults.reportdefinitions[i].props.rd_name.uiValues[0].toLowerCase().indexOf( searchData.criteria.searchString.toLowerCase() ) >= 0 ) {
                filterResults[cnt] = searchResults.reportdefinitions[i];
                cnt++;
            }
        }
        dataProvider.viewModelCollection.update( filterResults, cnt );
    } else if( searchResults  && searchResults.reportdefinitions !== undefined ) {
        dataProvider.viewModelCollection.update( searchResults.reportdefinitions, searchResults.reportdefinitions.length );
    }
    if( searchResults && searchData ) {
        const newSearchData = searchData.getValue();
        newSearchData.totalFound = dataProvider.viewModelCollection.loadedVMObjects.length;
        searchData.update( newSearchData );
    }
};

export default exports = {
    getReportDefinitionVal,
    loadColumns,
    updateDataProvider,
    performSelectionAndRunReport
};
