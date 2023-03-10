

import AwHttpService from 'js/awHttpService';
import AwPromiseService from 'js/awPromiseService';
import browserUtils from 'js/browserUtils';
import dateTimeService from 'js/dateTimeService';
import iconSvc from 'js/iconService';
import logger from 'js/logger';
import _localeSvc from 'js/localeService';
import _ from 'lodash';
import mesgSvc from 'js/messagingService';

var exports = {};

export let loadDashboardData = function ( searchInput ) {
    var deferred = AwPromiseService.instance.defer();
    var $http = AwHttpService.instance;
    var launchInfoInput = {
        "searchInput" : searchInput
    };
    
    var targetURL = browserUtils.getBaseURL() + "tc/micro/dpvservice/gra/operation/latestReportStatus";

    var postPromise = $http.post(targetURL, launchInfoInput,{
        headers: {}});
    postPromise.then(function (response) {
        if ( response && response.data && response.data.Data) {
            var updatedResponse =  _.clone( response.data.Data );
            processDashboardResponse( updatedResponse );
            deferred.resolve( updatedResponse );
        } else {
            logger.error("latestReportStatus : Invalid Response.");
        }
    }, function (err) {
        // error message if the soa call's promise is not resolved.
        mesgSvc.showError( err.message );
        deferred.reject(err);
    });
    return deferred.promise;
};

function processDashboardResponse( response ) {
    if( response && response.searchResults ) {
        _.forEach( response.searchResults, function( obj ) {
            obj.StartedAt = dateTimeService.formatSessionDateTime( obj.StartedAt );
            obj.CompletedAt = dateTimeService.formatSessionDateTime( obj.CompletedAt );
        });
    }
    response.columnConfig = getRepExecColumnConfig();
}

export let getRepExecColumnConfig = function () {
    var resource = 'DpvColumnConfigurationMessages';
    var dpvColCfgBundle = _localeSvc.getLoadedText( resource );

    var columnConfig =
    {
        columnConfigId: "",
        operationType: "",
        columns: [
            {
                displayName: dpvColCfgBundle["repExecReportName"],
                typeName: "",
                propertyName: "ReportName",
                pixelWidth: 200,
                columnOrder: 100,
                hiddenFlag: false,
                sortPriority: 0,
                sortDirection: "",
                filterDefinitionKey: "",
                isFilteringEnabled: true,
                dataType: "String",
                isFrozen: false,
                filterValue: {
                    operation: ""
                }
            },
            {
                displayName: dpvColCfgBundle["repExecStatus"],
                typeName: "",
                propertyName: "Status",
                pixelWidth: 100,
                columnOrder: 200,
                hiddenFlag: false,
                sortPriority: 0,
                sortDirection: "",
                filterDefinitionKey: "",
                isFilteringEnabled: true,
                dataType: "String",
                isFrozen: false,
                filterValue: {
                    operation: ""
                }
            },
            {
                displayName: dpvColCfgBundle["repExecStartedAt"],
                typeName: "",
                propertyName: "StartedAt",
                pixelWidth: 150,
                columnOrder: 300,
                hiddenFlag: false,
                sortPriority: 0,
                sortDirection: "",
                filterDefinitionKey: "",
                isFilteringEnabled: true,
                dataType: "String",
                isFrozen: false,
                filterValue: {
                    operation: ""
                }
            },
            {
                displayName: dpvColCfgBundle["repExecCompletedAt"],
                typeName: "",
                propertyName: "CompletedAt",
                pixelWidth: 150,
                columnOrder: 400,
                hiddenFlag: false,
                sortPriority: 0,
                sortDirection: "",
                filterDefinitionKey: "",
                isFilteringEnabled: true,
                dataType: "String",
                isFrozen: false,
                filterValue: {
                    operation: ""
                }
            },
            {
                displayName: dpvColCfgBundle["repExecDuration"],
                typeName: "",
                propertyName: "Duration",
                pixelWidth: 75,
                columnOrder: 500,
                hiddenFlag: false,
                sortPriority: 0,
                sortDirection: "",
                filterDefinitionKey: "",
                isFilteringEnabled: true,
                dataType: "INTEGER",
                isFrozen: false,
                filterValue: {
                    operation: ""
                }
            },
            {
                displayName: dpvColCfgBundle["repExecAvgDuration"],
                typeName: "",
                propertyName: "AvgDuration",
                pixelWidth: 75,
                columnOrder: 600,
                hiddenFlag: false,
                sortPriority: 0,
                sortDirection: "",
                filterDefinitionKey: "",
                isFilteringEnabled: true,
                dataType: "INTEGER",
                isFrozen: false,
                filterValue: {
                    operation: ""
                }
            },
            {
                displayName: dpvColCfgBundle["repExecNumPagesGenerated"],
                typeName: "",
                propertyName: "NumPagesGenerated",
                pixelWidth: 75,
                columnOrder: 600,
                hiddenFlag: false,
                sortPriority: 0,
                sortDirection: "",
                filterDefinitionKey: "",
                isFilteringEnabled: true,
                dataType: "INTEGER",
                isFrozen: false,
                filterValue: {
                    operation: ""
                }
            },
            {
                displayName: dpvColCfgBundle["repExecScheduleName"],
                typeName: "",
                propertyName: "ScheduleName",
                pixelWidth: 150,
                columnOrder: 700,
                hiddenFlag: false,
                sortPriority: 1,
                sortDirection: "Descending",
                filterDefinitionKey: "",
                isFilteringEnabled: true,
                dataType: "String",
                isFrozen: false,
                filterValue: {
                    operation: ""
                }
            }
        ]
    };
    return columnConfig;
};

export let loadRepExecHistory = function ( searchInput, reportId ) {
    var deferred = AwPromiseService.instance.defer();
    var $http = AwHttpService.instance;
    var launchInfoInput = {
        "searchInput" : searchInput
    };
    
    var targetURL = browserUtils.getBaseURL() + "tc/micro/dpvservice/gra/operation/executionhistory/"+reportId;
    var postPromise = $http.post(targetURL, launchInfoInput,{
        headers: {}});
    postPromise.then(function (response) {
        if ( response && response.data && response.data.Data) {
            var updatedResponse =  _.clone( response.data.Data );
            processExecHistoryResponse( updatedResponse );
            deferred.resolve( updatedResponse );
        } else {
            logger.error("executionhistory : Invalid Response.");
        }
    }, function (err) {
        // error message if the soa call's promise is not resolved.
        deferred.reject(err);
    });
    
    return deferred.promise;
};

function processExecHistoryResponse( response ) {
    if( response && response.searchResults ) {
        _.forEach( response.searchResults, function( obj ) {
            obj.StartedAt = dateTimeService.formatSessionDateTime( obj.StartedAt );
            obj.FinishedAt = dateTimeService.formatSessionDateTime( obj.FinishedAt );
        });
    }
    response.columnConfig = getRepExecHistColumnConfig();
}

export let getRepExecHistColumnConfig = function () {
    var resource = 'DpvColumnConfigurationMessages';
    var dpvColCfgBundle = _localeSvc.getLoadedText( resource );

    var columnConfig =
    {
        columnConfigId: "",
        operationType: "",
        columns: [
            {
                displayName: dpvColCfgBundle["repExecHistJobId"],
                typeName: "",
                propertyName: "JobId",
                pixelWidth: 100,
                columnOrder: 200,
                hiddenFlag: false,
                sortPriority: 0,
                sortDirection: "",
                filterDefinitionKey: "",
                isFilteringEnabled: true,
                dataType: "INTEGER",
                isFrozen: false,
                filterValue: {
                    operation: ""
                }
            },
            {
                displayName: dpvColCfgBundle["repExecHistStatus"],
                typeName: "",
                propertyName: "Status",
                pixelWidth: 100,
                columnOrder: 200,
                hiddenFlag: false,
                sortPriority: 0,
                sortDirection: "",
                filterDefinitionKey: "",
                isFilteringEnabled: true,
                dataType: "String",
                isFrozen: false,
                filterValue: {
                    operation: ""
                }
            },
            {
                displayName: dpvColCfgBundle["repExecHistStartedAt"],
                typeName: "",
                propertyName: "StartedAt",
                pixelWidth: 150,
                columnOrder: 300,
                hiddenFlag: false,
                sortPriority: 0,
                sortDirection: "",
                filterDefinitionKey: "",
                isFilteringEnabled: true,
                dataType: "String",
                isFrozen: false,
                filterValue: {
                    operation: ""
                }
            },
            {
                displayName: dpvColCfgBundle["repExecHistFinishedAt"],
                typeName: "",
                propertyName: "FinishedAt",
                pixelWidth: 150,
                columnOrder: 400,
                hiddenFlag: false,
                sortPriority: 0,
                sortDirection: "",
                filterDefinitionKey: "",
                isFilteringEnabled: true,
                dataType: "String",
                isFrozen: false,
                filterValue: {
                    operation: ""
                }
            },
            {
                displayName: dpvColCfgBundle["repExecHistDuration"],
                typeName: "",
                propertyName: "Duration",
                pixelWidth: 100,
                columnOrder: 400,
                hiddenFlag: false,
                sortPriority: 0,
                sortDirection: "",
                filterDefinitionKey: "",
                isFilteringEnabled: true,
                dataType: "DOUBLE",
                isFrozen: false,
                filterValue: {
                    operation: ""
                }
            },
            {
                displayName: dpvColCfgBundle["repExecHistNumPdfPages"],
                typeName: "",
                propertyName: "NumPdfPages",
                pixelWidth: 100,
                columnOrder: 400,
                hiddenFlag: false,
                sortPriority: 0,
                sortDirection: "",
                filterDefinitionKey: "",
                isFilteringEnabled: true,
                dataType: "DOUBLE",
                isFrozen: false,
                filterValue: {
                    operation: ""
                }
            },
            {
                displayName: dpvColCfgBundle["repExecHistScheduleName"],
                typeName: "",
                propertyName: "ScheduleName",
                pixelWidth: 150,
                columnOrder: 400,
                hiddenFlag: false,
                sortPriority: 0,
                sortDirection: "",
                filterDefinitionKey: "",
                isFilteringEnabled: true,
                dataType: "String",
                isFrozen: false,
                filterValue: {
                    operation: ""
                }
            },
            {
                displayName: dpvColCfgBundle["repExecHistWorkerAddress"],
                typeName: "",
                propertyName: "WorkerAddress",
                pixelWidth: 150,
                columnOrder: 400,
                hiddenFlag: false,
                sortPriority: 0,
                sortDirection: "",
                filterDefinitionKey: "",
                isFilteringEnabled: true,
                dataType: "String",
                isFrozen: false,
                filterValue: {
                    operation: ""
                }
            }
        ]
    };
    return columnConfig;
};

export let resubmitReportJob = function ( selectedJobs ) {
    var deferred = AwPromiseService.instance.defer();
    var len = selectedJobs.length;
    var reportId = selectedJobs[0].props.ReportId.displayValues[0];
    var url = browserUtils.getBaseURL() + "tc/micro/dpvservice/gra/operation/resubmit/"+reportId;

    var $http = AwHttpService.instance;
    var postPromise = $http.get(url);
    postPromise.then(function (response) {
        deferred.resolve(response.data);
    }, function (err) {
        // error message if the ms call's promise is not resolved.
        deferred.reject(err);
    });
    return deferred.promise;
};

export let setDateRange = function ( data ) {
    var endDate = new Date();
    var startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    startDate = dateTimeService.formatUTC(startDate);
    startDate = dateTimeService.formatDate(startDate);

    endDate = dateTimeService.formatUTC(endDate);
    endDate = dateTimeService.formatDate(endDate);

    var dataClone = _.clone( data );

    dataClone.startDate.dbValue = startDate;
    dataClone.endDate.dbValue = endDate; 

    return {
        startDate: dataClone.startDate,
        endDate: dataClone.endDate
    };
};

export let createChart = function (type) {
    var deferred = AwPromiseService.instance.defer();
    var repNames = [];
    var repCounts = [];
    var keyValueDataForChart = [];
    var chartPoints = [];
    
    const dpvTextBundle = _localeSvc.getLoadedText( 'DpvMessages' );

    var chartName = "";
    var url = browserUtils.getBaseURL() + "tc/micro/dpvservice/gra/operation/viewcount/top/20";
    chartName = dpvTextBundle["mostAccessedRepChartTitle"];
    if (type === 'leastAccessed') {
        url = browserUtils.getBaseURL() + "tc/micro/dpvservice/gra/operation/viewcount/bottom/20";
        chartName = dpvTextBundle["leastAcessedRepChartTitle"];
    }
    var $http = AwHttpService.instance;
    var postPromise = $http.get(url);
    postPromise.then(function (response) {
        if (response && response.data && response.data.Data) {
            let reportDataArr = response.data.Data;
            for (var ind = 0; ind < reportDataArr.length; ind++) {
                // Remove below workaround "XYZ" after serverside is fixed
                var repName = !reportDataArr[ind].ReportName ? "XYZ" + ind : reportDataArr[ind].ReportName;
                var repCount = !reportDataArr[ind].ViewCount ? 0 : reportDataArr[ind].ViewCount;
                repNames.push(repName);
                repCounts.push(repCount);
            }
            var length = repNames.length > 20 ? 20 : repNames.length;

            for (var indx = 0; indx < length; indx++) {
                keyValueDataForChart.push({
                    label: repNames[indx],
                    internalLabel: repNames[indx],
                    value: repCounts[indx],
                    name: repNames[indx],
                    y: repNames[indx]
                });
            }
            chartPoints.push({
                seriesName: chartName,
                keyValueDataForChart: keyValueDataForChart,
                chartPointsConfig: 'colorOverrides'
            });
            deferred.resolve(chartPoints);
        }
    }, function (err) {
        // error message if the ms call's promise is not resolved.
        deferred.reject(err);
    });
    return deferred.promise;
};

export let populateResubmitError = function (response) {
    var message = "";
    if (response.Errors && response.Errors.length > 0) {
        message = response.Errors[0];
    }
    return message;
};

export let openScheduledReport = function ( reportId ) {
    var deferred = AwPromiseService.instance.defer();

    var url = browserUtils.getBaseURL() + "tc/micro/dpvservice/gra/operation/scheduledreport/"+reportId;

    window.open( url, '_blank' );

    deferred.resolve(null);
    return deferred.promise;
};

export const updateSearchResultsWithIcon = ( searchResponse ) => {
    var schIconName = 'typeHTMLReport48.svg';
    var imageIconUrl = iconSvc.getTypeIconFileUrl( schIconName );
    var searchResults = _.clone(searchResponse.searchResults);
    _.forEach( searchResults, function( vmoJob ) {
        vmoJob.thumbnailURL = imageIconUrl;
        vmoJob.hasThumbnail = true;
    } );

    return searchResults;
};

export default exports = {
    loadDashboardData,
    getRepExecColumnConfig,
    loadRepExecHistory,
    getRepExecHistColumnConfig,
    resubmitReportJob,
    createChart,
    setDateRange,
    populateResubmitError,
    openScheduledReport,
    updateSearchResultsWithIcon
};
