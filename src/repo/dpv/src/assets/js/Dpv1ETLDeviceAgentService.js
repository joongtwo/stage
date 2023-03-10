// Copyright (c) 2022 Siemens
/**
 * @module js/Dpv1ETLDeviceAgentService
 */
import AwHttpService from 'js/awHttpService';
import AwPromiseService from 'js/awPromiseService';
import browserUtils from 'js/browserUtils';
import dateTimeService from 'js/dateTimeService';
import iconSvc from 'js/iconService';
import _ from 'lodash';
import logger from 'js/logger';
import _localeSvc from 'js/localeService';
var exports = {};

export let loadDeviceOverviewData = function (selection) {
    var deferred = AwPromiseService.instance.defer();
    let plantIDs = [];

    let outputData = {
        "totalFound ": 0,
        "searchResults": []
    };

    if (selection && selection.length > 0) {
        _.forEach(selection, function (selected) {
            plantIDs.push(selected.props.PlantId.displayValues[0]);
        });

        var $http = AwHttpService.instance;
        var searchCriteriaPost = {
            "plants": plantIDs
        };
        var searchInputPost = {
            searchCriteria: searchCriteriaPost,
            StartIndex: 0,
            MaxToReturn: 50,
            cursor: {},
            searchFilterFieldSortType: 'Alphabetical',
            searchFilterMap6: {}
        };
        var launchInfoInput = {
            "searchInput": searchInputPost
        };
        var targetURL = browserUtils.getBaseURL() + "tc/micro/dpvservice/etl/operation/dashboard/xferAgentOverview";
        var timeZoneOffset = getTimeZoneOffset();
        var postPromise = $http.post(targetURL, launchInfoInput,{
            headers: { 'TimeZoneOffset': timeZoneOffset }});
        postPromise.then(function (response) {
            if (response && response.data && response.data.Data) {
                outputData.totalFound = response.data.Data.totalFound;
                outputData.searchResults = response.data.Data.searchResults;
                processDeviceOverviewResponse(outputData);
                deferred.resolve(outputData);
            }
        }, function (err) {
            deferred.reject(err);
        });
    } else {
        deferred.resolve(outputData);
    }
    return deferred.promise;
};

function processDeviceOverviewResponse( outputData ) {
    if( outputData && outputData.searchResults ) {
        _.forEach( outputData.searchResults, function( obj ) {
            obj.LastCommunication = dateTimeService.formatSessionDateTime( obj.LastCommunication );
            obj.LastFileXferTime = dateTimeService.formatSessionDateTime( obj.LastFileXferTime );
        });
    }
}

function getTimeZoneOffset() {
    const date = new Date();
    return date.getTimezoneOffset();
}

export let loadDeviceAgentReportData = function (searchState, statType) {
    var deferred = AwPromiseService.instance.defer();
    var targetResponse = {};
    if (searchState.deviceAgentInfo.plantId && searchState.deviceAgentInfo.deviceAgent) {
        let plantId = searchState.deviceAgentInfo.plantId;
        let agentName = searchState.deviceAgentInfo.deviceAgent;

        var url = browserUtils.getBaseURL() + "tc/micro/dpvservice/etl/operation/dashboard/xferAgentDetail?plantId=" + plantId + "&agentName=" + agentName;
        var $http = AwHttpService.instance;
        var postPromise = $http.get(url);
        postPromise.then(function (response) {
            if (response && response.data && response.data.Data) {
                var updatedResponse = _.clone(response.data.Data);
                if (statType === "hourly") {
                    targetResponse = processHourlyDeviceAgentResponse(updatedResponse, statType);
                } else {
                    targetResponse = processMinuteDeviceAgentResponse(updatedResponse, statType);
                }
                deferred.resolve(targetResponse);
            } else {
                logger.error("Device Agent Reports : Invalid Response.");
            }
        }, function (err) {
            deferred.reject(err);
        });
    } else {
        if (statType === "hourly") {
            deferred.resolve(processHourlyDeviceAgentResponse(targetResponse, statType));
        } else {
            deferred.resolve(processMinuteDeviceAgentResponse(targetResponse, statType));
        }
    }
    return deferred.promise;
};

function processHourlyDeviceAgentResponse(response, statType) {
    let targetResults = [];
    if (response && response.HourlyStatistics) {
        var baseHourlyDeviceAgentInfo = response;
        for (var ind = 0; ind < baseHourlyDeviceAgentInfo.HourlyStatistics.length; ind++) {
            var hourlyDeviceAgentValObj = baseHourlyDeviceAgentInfo.HourlyStatistics[ind];
            let hourlyDeviceAgentInfoObj = (ind > 0) ? _.cloneDeep(baseHourlyDeviceAgentInfo) : baseHourlyDeviceAgentInfo;
            hourlyDeviceAgentInfoObj.Hour = hourlyDeviceAgentValObj.Hour;
            hourlyDeviceAgentInfoObj.NumFileXferred = hourlyDeviceAgentValObj.NumFileXferred;
            hourlyDeviceAgentInfoObj.AvgXferTime = hourlyDeviceAgentValObj.AvgXferTime;
            hourlyDeviceAgentInfoObj.MaxXferTime = hourlyDeviceAgentValObj.MaxXferTime;
            hourlyDeviceAgentInfoObj.MinXferTime = hourlyDeviceAgentValObj.MinXferTime;
            hourlyDeviceAgentInfoObj.Availability = hourlyDeviceAgentValObj.Availability;
            hourlyDeviceAgentInfoObj.Failures = hourlyDeviceAgentValObj.Failures;
            targetResults.push(hourlyDeviceAgentInfoObj);
        }
    }
    var sortedTargetResults = _.sortBy(targetResults, [function (hrObj) { return hrObj.Hour; }]);
    response.searchResults = sortedTargetResults;
    response.totalLoaded = sortedTargetResults.length;
    response.totalFound = sortedTargetResults.length;
    response.columnConfig = getDeviceAgentReportColumnConfig(statType);
    return response;
}

function processMinuteDeviceAgentResponse(response, statType) {
    let targetResults = [];
    if (response && response.MinuteStatistics) {
        var baseMinuteDeviceAgentInfo = response;
        for (var ind = 0; ind < baseMinuteDeviceAgentInfo.MinuteStatistics.length; ind++) {
            var minuteDeviceAgentValObj = baseMinuteDeviceAgentInfo.MinuteStatistics[ind];
            let minuteDeviceAgentInfoObj = (ind > 0) ? _.cloneDeep(baseMinuteDeviceAgentInfo) : baseMinuteDeviceAgentInfo;
            minuteDeviceAgentInfoObj.Minute = minuteDeviceAgentValObj.Minute;
            minuteDeviceAgentInfoObj.NumFileXferred = minuteDeviceAgentValObj.NumFileXferred;
            minuteDeviceAgentInfoObj.AvgXferTime = minuteDeviceAgentValObj.AvgXferTime;
            minuteDeviceAgentInfoObj.MaxXferTime = minuteDeviceAgentValObj.MaxXferTime;
            minuteDeviceAgentInfoObj.MinXferTime = minuteDeviceAgentValObj.MinXferTime;
            minuteDeviceAgentInfoObj.Availability = minuteDeviceAgentValObj.Availability;
            minuteDeviceAgentInfoObj.Failures = minuteDeviceAgentValObj.Failures;
            targetResults.push(minuteDeviceAgentInfoObj);
        }
    }
    var sortedTargetResults = _.sortBy(targetResults, [function (minObj) { return minObj.Minute; }]);
    response.searchResults = sortedTargetResults;
    response.totalLoaded = sortedTargetResults.length;
    response.totalFound = sortedTargetResults.length;
    response.columnConfig = getDeviceAgentReportColumnConfig(statType);
    return response;
}

function getDeviceAgentReportColumnConfig(statType) {
    var resource = 'DpvColumnConfigurationMessages';
    var dpvColCfgBundle = _localeSvc.getLoadedText(resource);

    var firstColDispName = statType === "hourly" ? dpvColCfgBundle["hour"] : dpvColCfgBundle["minute"];
    var firstColPropName = statType === "hourly" ? "Hour" : "Minute";
    var columnConfig = {
        columnConfigId: "",
        operationType: "",
        columns: [{
            displayName: firstColDispName,
            typeName: "",
            propertyName: firstColPropName,
            pixelWidth: 100,
            columnOrder: 100,
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
            displayName: dpvColCfgBundle["filesTransferred"],
            typeName: "",
            propertyName: "FilesTransferred",
            pixelWidth: 200,
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
            displayName: dpvColCfgBundle["avgFileTransferTime"],
            typeName: "",
            propertyName: "AvgFileTransferTime",
            pixelWidth: 220,
            columnOrder: 220,
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
            displayName: dpvColCfgBundle["minFileTransferTime"],
            typeName: "",
            propertyName: "MinFileTransferTime",
            pixelWidth: 220,
            columnOrder: 220,
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
            displayName: dpvColCfgBundle["maxFileTransferTime"],
            typeName: "",
            propertyName: "MaxFileTransferTime",
            pixelWidth: 220,
            columnOrder: 220,
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
            displayName: dpvColCfgBundle["availability"],
            typeName: "",
            propertyName: "Availability",
            pixelWidth: 100,
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
            displayName: dpvColCfgBundle["error"],
            typeName: "",
            propertyName: "Error",
            pixelWidth: 100,
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
        }]
    };
    return columnConfig;
}

export let updateDeviceAgentInfo = function (gridSelection, searchState) {
    let searchStateData = { ...searchState.value };
    
    var plantId = gridSelection.length>0 ? gridSelection[0].props.PlantID.dbValue : "";
    var deviceAgent = gridSelection.length>0 ? gridSelection[0].props.DeviceAgent.dbValue : "";
    var plantName = gridSelection.length>0 ? gridSelection[0].props.PlantName.dbValue : "";

    if(searchStateData.deviceAgentInfo) {
        searchStateData.deviceAgentInfo.plantId = plantId;
        searchStateData.deviceAgentInfo.deviceAgent = deviceAgent;
        searchStateData.deviceAgentInfo.plantName = plantName;
    } else {
        const deviceAgentInfo = {
            "plantId": plantId,
            "deviceAgent": deviceAgent,
            "plantName": plantName,
            "selectedStatOption": "hourly"
        };
        searchStateData.deviceAgentInfo = deviceAgentInfo;
    }
    searchState.update({ ...searchStateData });
};

export let updateStatOption = function( searchState, commandId ) {
    let stateData = { ...searchState.value };
    stateData.deviceAgentInfo.selectedStatOption = commandId === "Dpv1DeviceAgentHourlyStat" ? "hourly" : "minute";
    searchState.update({ ...stateData });
};

export let updateShowGraph = function (searchState, commandId ) {
    let stateData = { ...searchState.value };
    stateData.deviceAgentInfo.showGraph = commandId === "Dpv1DeviceAgentShowGraph" ? true : false;
    searchState.update({ ...stateData });
};

export let createHourlyFilesTransferredLineChart = function (hourlyStatDataProvider, seriesName) {
    var arrayOfSeriesDataForChart = [];
    var keyValueDataForChart = [];

    const loadedHourlyStatVMOs = hourlyStatDataProvider.viewModelCollection.loadedVMObjects;
    loadedHourlyStatVMOs.forEach((vmo, index) => {
        var pointVal = vmo.props.FilesTransferred.dbValue ? vmo.props.FilesTransferred.dbValue : 0;
        keyValueDataForChart.push({
            label: "" + vmo.props.Hour.dbValue,
            value: pointVal
        });
    });
    arrayOfSeriesDataForChart.push({
        seriesName: seriesName,
        keyValueDataForChart: keyValueDataForChart
    });

    return arrayOfSeriesDataForChart;
};

export let createMinuteFilesTransferredLineChart = function (minStatdataProvider, seriesName) {
    var arrayOfSeriesDataForChart = [];
    var keyValueDataForChart = [];

    const loadedMinStatVMOs = minStatdataProvider.viewModelCollection.loadedVMObjects;
    loadedMinStatVMOs.forEach((vmo, index) => {
        var pointVal = vmo.props.FilesTransferred.dbValue ? vmo.props.FilesTransferred.dbValue : 0;
        keyValueDataForChart.push({
            label: "" + vmo.props.Minute.dbValue,
            value: pointVal
        });
    });
    arrayOfSeriesDataForChart.push({
        seriesName: seriesName,
        keyValueDataForChart: keyValueDataForChart
    });

    return arrayOfSeriesDataForChart;
};

export let selectTableRow = function ( searchState, dataProvider ) {
    if (searchState.deviceAgentInfo && searchState.deviceAgentInfo.plantId) {
        var loadedObjects = dataProvider.viewModelCollection.loadedVMObjects;
        var selection = loadedObjects.filter( function( element ) {
            return ( element.props.PlantID.dbValue === searchState.deviceAgentInfo.plantId && 
                element.props.DeviceAgent.dbValue === searchState.deviceAgentInfo.deviceAgent );
        } );
        dataProvider.selectionModel.setSelection(selection);
    }
};

export const updateSearchResultsWithIcon = ( searchResponse, svgIconFile ) => {
    var schIconName = svgIconFile ? svgIconFile : 'typeReportDefinition48.svg';
    
    var imageIconUrl = iconSvc.getTypeIconFileUrl( schIconName );
    var searchResults = _.clone(searchResponse.searchResults);
    _.forEach( searchResults, function( vmoSch ) {
        vmoSch.thumbnailURL = imageIconUrl;
        vmoSch.hasThumbnail = true;
    } );
    return searchResults;
};

export default exports = {
    loadDeviceOverviewData,
    loadDeviceAgentReportData,
    updateDeviceAgentInfo,
    updateStatOption,
    updateShowGraph,
    createHourlyFilesTransferredLineChart,
    createMinuteFilesTransferredLineChart,
    selectTableRow,
    updateSearchResultsWithIcon
};