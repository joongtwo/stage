// Copyright (c) 2022 Siemens
/**
 * @module js/Dpv1ETLHealthService
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

export let loadHealthReportData = function( selection ) {
    var deferred = AwPromiseService.instance.defer();
    var targetResponse = {};
    var plantNames = [];
    if ( selection && selection.length > 0 ) {
        _.forEach( selection, function( selected ) {
            plantNames.push( selected.props.PlantName.displayValues[0] );
        } );
        var $http = AwHttpService.instance;
        var searchCriteriaPost = {
            availability: 95.5,
            plants: plantNames
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
            searchInput: searchInputPost
        };
        var totalFound = 0;
        var targetURL = browserUtils.getBaseURL() + 'tc/micro/dpvservice/etl/operation/dashboard/healthOverview';
        var postPromise = $http.post( targetURL, launchInfoInput );
        postPromise.then( function( response ) {
            if ( response && response.data && response.data.Data ) {
                totalFound = response.data.Data.totalFound;
                if ( totalFound > 0 ) {
                    targetResponse = _.clone( response.data.Data );
                    processHealthReportResponse( targetResponse );
                }
                deferred.resolve( targetResponse );
            }
        }, function( err ) {
            deferred.reject( err );
        } );
    } else {
        deferred.resolve( processHealthReportResponse( targetResponse ) );
    }
    return deferred.promise;
};

function processHealthReportResponse( response ) {
    let targetResults = [];
    if ( response && response.searchResults ) {
        for ( var idx = 0; idx < response.searchResults.length; idx++ ) {
            var baseHealthInfo = response.searchResults[idx];
            for ( var ind = 0; ind < baseHealthInfo.DeviceOVerview.length; ind++ ) {
                var healthValObj = baseHealthInfo.DeviceOVerview[ind];
                let healthInfoObj = ind > 0 ? _.cloneDeep( baseHealthInfo ) : baseHealthInfo;
                healthInfoObj.DeviceName = healthValObj.DeviceName;
                healthInfoObj.DeviceId = healthValObj.DeviceId;
                healthInfoObj.FailedFiles = healthValObj.FailedFiles;
                healthInfoObj.SuccessFiles = healthValObj.SuccessFiles;
                healthInfoObj.PartialSuccessFiles = healthValObj.PartialSuccessFiles;
                targetResults.push( healthInfoObj );
            }
        }
    }
    response.searchResults = targetResults;
    response.totalLoaded = targetResults.length;
    response.totalFound = targetResults.length;
    response.columnConfig = getHealthReportColumnConfig();
}

function getHealthReportColumnConfig() {
    var resource = 'DpvColumnConfigurationMessages';
    var dpvColCfgBundle = _localeSvc.getLoadedText( resource );
    return {
        columnConfigId: '',
        operationType: '',
        columns: [
            {
                displayName: dpvColCfgBundle.plantName,
                typeName: '',
                propertyName: 'PlantName',
                pixelWidth: 150,
                columnOrder: 100,
                hiddenFlag: false,
                sortPriority: 0,
                sortDirection: '',
                filterDefinitionKey: '',
                isFilteringEnabled: true,
                dataType: 'String',
                isFrozen: false,
                filterValue: {
                    operation: ''
                }
            },
            {
                displayName: dpvColCfgBundle.measDevice,
                typeName: '',
                propertyName: 'MeasDevice',
                pixelWidth: 150,
                columnOrder: 400,
                hiddenFlag: false,
                sortPriority: 0,
                sortDirection: '',
                filterDefinitionKey: '',
                isFilteringEnabled: true,
                dataType: 'String',
                isFrozen: false,
                filterValue: {
                    operation: ''
                }
            },
            {
                displayName: dpvColCfgBundle.filesInFailedFolder,
                typeName: '',
                propertyName: 'TotalFilesFailedFolder',
                pixelWidth: 150,
                columnOrder: 100,
                hiddenFlag: false,
                sortPriority: 0,
                sortDirection: '',
                filterDefinitionKey: '',
                isFilteringEnabled: true,
                dataType: 'Integer',
                isFrozen: false,
                filterValue: {
                    operation: ''
                }
            },
            {
                displayName: dpvColCfgBundle.filesInSuccessFolder,
                typeName: '',
                propertyName: 'TotalFilesSuccessFolder',
                pixelWidth: 150,
                columnOrder: 300,
                hiddenFlag: false,
                sortPriority: 0,
                sortDirection: '',
                filterDefinitionKey: '',
                isFilteringEnabled: true,
                dataType: 'Integer',
                isFrozen: false,
                filterValue: {
                    operation: ''
                }
            },
            {
                displayName: dpvColCfgBundle.filesInPartialSuccessFolder,
                typeName: '',
                propertyName: 'TotalFilesPartialSuccessFolder',
                pixelWidth: 150,
                columnOrder: 300,
                hiddenFlag: false,
                sortPriority: 0,
                sortDirection: '',
                filterDefinitionKey: '',
                isFilteringEnabled: true,
                dataType: 'Integer',
                isFrozen: false,
                filterValue: {
                    operation: ''
                }
            }
        ]
    };
}

export let loadFailedFiles = function( searchInput ) {
    var deferred = AwPromiseService.instance.defer();

    var launchInfoInput = {
        searchInput : searchInput
    };

    var url = browserUtils.getBaseURL() + 'tc/micro/dpvservice/etl/operation/dashboard/files';
    var $http = AwHttpService.instance;
    var postPromise = $http.post( url, launchInfoInput );

    postPromise.then( function( response ) {
        if ( response && response.data && response.data.Data ) {
            var updatedResponse = _.clone( response.data.Data );
            var updatedFailedResponse = processFailedReportResponse( updatedResponse );
            deferred.resolve( updatedFailedResponse );
        } else {
            logger.error( 'Failed Reports : Invalid Response.' );
        }
    }, function( err ) {
        // error message if the ms call's promise is not resolved.
        deferred.reject( err );
    } );
    return deferred.promise;
};

function processFailedReportResponse( response ) {
    let targetResults = [];
    if ( response ) {
        var baseFailedInfo = response.searchResults;
        for ( var ind = 0; ind < baseFailedInfo.DeviceFiles.length; ind++ ) {
            var failedValObj = baseFailedInfo.DeviceFiles[ind];
            let failedInfoObj = ind > 0 ? _.cloneDeep( baseFailedInfo ) : baseFailedInfo;
            failedInfoObj.DataFile = failedValObj.DataFile;
            failedInfoObj.DataFileName = getFilenameFromPath( failedValObj.DataFile );
            failedInfoObj.DMLFile = failedValObj.DMLFile;
            failedInfoObj.DMLFileName = getFilenameFromPath( failedValObj.DMLFile );
            failedInfoObj.ErrorFile = failedValObj.ErrorFile;
            failedInfoObj.ErrorFileName = getFilenameFromPath( failedValObj.ErrorFile );
            failedInfoObj.ProcessedTime = dateTimeService.formatSessionDateTime( failedValObj.ProcessedTime );
            targetResults.push( failedInfoObj );
        }
    }
    response.searchResults = targetResults;
    response.totalLoaded = targetResults.length;
    response.columnConfig = getFailedReportColumnConfig();
    return response;
}

function getFailedReportColumnConfig() {
    var resource = 'DpvColumnConfigurationMessages';
    var dpvColCfgBundle = _localeSvc.getLoadedText( resource );
    return {
        columnConfigId: '',
        operationType: '',
        columns: [
            {
                displayName: dpvColCfgBundle.fileName,
                typeName: '',
                propertyName: 'FileName',
                pixelWidth: 300,
                columnOrder: 300,
                hiddenFlag: false,
                sortPriority: 0,
                sortDirection: '',
                filterDefinitionKey: '',
                isFilteringEnabled: true,
                dataType: 'String',
                isFrozen: false,
                filterValue: {
                    operation: ''
                }
            },
            {
                displayName: dpvColCfgBundle.processTime,
                typeName: '',
                propertyName: 'ProcessTime',
                pixelWidth: 250,
                columnOrder: 250,
                hiddenFlag: false,
                sortPriority: 0,
                sortDirection: '',
                filterDefinitionKey: '',
                isFilteringEnabled: true,
                dataType: 'String',
                isFrozen: false,
                filterValue: {
                    operation: ''
                }
            }
        ]
    };
}

export let loadSuccessFiles = function( searchInput ) {
    var deferred = AwPromiseService.instance.defer();

    var launchInfoInput = {
        searchInput : searchInput
    };

    var url = browserUtils.getBaseURL() + 'tc/micro/dpvservice/etl/operation/dashboard/files';
    var $http = AwHttpService.instance;
    var postPromise = $http.post( url, launchInfoInput );

    postPromise.then( function( response ) {
        if ( response && response.data && response.data.Data ) {
            var updatedResponse = _.clone( response.data.Data );
            var updatedFailedResponse = processSuccessReportResponse( updatedResponse );
            deferred.resolve( updatedFailedResponse );
        } else {
            logger.error( 'Failed Reports : Invalid Response.' );
        }
    }, function( err ) {
        deferred.reject( err );
    } );
    return deferred.promise;
};

function processSuccessReportResponse( response ) {
    let targetResults = [];
    if ( response ) {
        var baseSuccessInfo = response.searchResults;
        for ( var ind = 0; ind < baseSuccessInfo.DeviceFiles.length; ind++ ) {
            var successValObj = baseSuccessInfo.DeviceFiles[ind];
            let successInfoObj = ind > 0 ? _.cloneDeep( baseSuccessInfo ) : baseSuccessInfo;
            successInfoObj.DataFile = successValObj.DataFile;
            successInfoObj.DataFileName = getFilenameFromPath( successValObj.DataFile );
            successInfoObj.ProcessedTime = dateTimeService.formatSessionDateTime( successValObj.ProcessedTime );
            targetResults.push( successInfoObj );
        }
    }
    response.searchResults = targetResults;
    response.totalLoaded = targetResults.length;
    response.columnConfig = getSuccessReportColumnConfig();
    return response;
}

function getSuccessReportColumnConfig() {
    var resource = 'DpvColumnConfigurationMessages';
    var dpvColCfgBundle = _localeSvc.getLoadedText( resource );
    return {
        columnConfigId: '',
        operationType: '',
        columns: [ {
            displayName: dpvColCfgBundle.fileName,
            typeName: '',
            propertyName: 'FileName',
            pixelWidth: 300,
            columnOrder: 300,
            hiddenFlag: false,
            sortPriority: 0,
            sortDirection: '',
            filterDefinitionKey: '',
            isFilteringEnabled: true,
            dataType: 'String',
            isFrozen: false,
            filterValue: {
                operation: ''
            }
        },
        {
            displayName: dpvColCfgBundle.processTime,
            typeName: '',
            propertyName: 'ProcessTime',
            pixelWidth: 250,
            columnOrder: 250,
            hiddenFlag: false,
            sortPriority: 0,
            sortDirection: '',
            filterDefinitionKey: '',
            isFilteringEnabled: true,
            dataType: 'String',
            isFrozen: false,
            filterValue: {
                operation: ''
            }
        } ]
    };
}

export let loadPartialSuccessFiles = function( searchInput ) {
    var deferred = AwPromiseService.instance.defer();

    var launchInfoInput = {
        searchInput : searchInput
    };

    var url = browserUtils.getBaseURL() + 'tc/micro/dpvservice/etl/operation/dashboard/files';
    var $http = AwHttpService.instance;
    var postPromise = $http.post( url, launchInfoInput );

    postPromise.then( function( response ) {
        if ( response && response.data && response.data.Data ) {
            var updatedResponse = _.clone( response.data.Data );
            var updatedPartialSuccessResponse = processPartialSuccessReportResponse( updatedResponse );
            deferred.resolve( updatedPartialSuccessResponse );
        } else {
            logger.error( 'Partial Success Reports : Invalid Response.' );
        }
    }, function( err ) {
        deferred.reject( err );
    } );
    return deferred.promise;
};

function processPartialSuccessReportResponse( response ) {
    let targetResults = [];
    if ( response ) {
        var basePartialSuccessInfo = response.searchResults;
        for ( var ind = 0; ind < basePartialSuccessInfo.DeviceFiles.length; ind++ ) {
            var partialSuccessValObj = basePartialSuccessInfo.DeviceFiles[ind];
            let partialSuccessInfoObj = ind > 0 ? _.cloneDeep( basePartialSuccessInfo ) : basePartialSuccessInfo;
            partialSuccessInfoObj.DataFile = partialSuccessValObj.DataFile;
            partialSuccessInfoObj.DataFileName = getFilenameFromPath( partialSuccessInfoObj.DataFile );
            partialSuccessInfoObj.WarningFile = partialSuccessValObj.WarningFile;
            partialSuccessInfoObj.WarningFileName = getFilenameFromPath( partialSuccessInfoObj.WarningFile );
            partialSuccessInfoObj.ProcessedTime =  dateTimeService.formatSessionDateTime( partialSuccessValObj.ProcessedTime );
            targetResults.push( partialSuccessInfoObj );
        }
    }
    response.searchResults = targetResults;
    response.totalLoaded = targetResults.length;
    response.columnConfig = getPartialSuccessReportColumnConfig();
    return response;
}

function getPartialSuccessReportColumnConfig() {
    var resource = 'DpvColumnConfigurationMessages';
    var dpvColCfgBundle = _localeSvc.getLoadedText( resource );
    return {
        columnConfigId: '',
        operationType: '',
        columns: [
            {
                displayName: dpvColCfgBundle.fileName,
                typeName: '',
                propertyName: 'FileName',
                pixelWidth: 300,
                columnOrder: 300,
                hiddenFlag: false,
                sortPriority: 0,
                sortDirection: '',
                filterDefinitionKey: '',
                isFilteringEnabled: true,
                dataType: 'String',
                isFrozen: false,
                filterValue: {
                    operation: ''
                }
            },
            {
                displayName: dpvColCfgBundle.processTime,
                typeName: '',
                propertyName: 'ProcessTime',
                pixelWidth: 250,
                columnOrder: 250,
                hiddenFlag: false,
                sortPriority: 0,
                sortDirection: '',
                filterDefinitionKey: '',
                isFilteringEnabled: true,
                dataType: 'String',
                isFrozen: false,
                filterValue: {
                    operation: ''
                }
            }
        ]
    };
}

export let createFilesPieChart = function( searchState ) {
    var arrayOfSeriesDataForChart = [];

    var keyValueDataForChart = [];
    let countFailed = searchState.healthInfo ? searchState.healthInfo.failedCount : -1;
    let countSuccess = searchState.healthInfo ? searchState.healthInfo.successCount : -1;
    let countPartialSuccess = searchState.healthInfo ? searchState.healthInfo.partialSuccessCount : -1;

    keyValueDataForChart.push( {
        label: '0',
        value: countFailed,
        name: 'Failed',
        y: countFailed
    } );

    keyValueDataForChart.push( {
        label: '1',
        value: countSuccess,
        name: 'Success',
        y: countSuccess
    } );

    keyValueDataForChart.push( {
        label: '2',
        value: countPartialSuccess,
        name: 'Partial Success',
        y: countPartialSuccess
    } );

    arrayOfSeriesDataForChart.push( {
        seriesName: 'Files in Folders',
        keyValueDataForChart: keyValueDataForChart
    } );
    return arrayOfSeriesDataForChart;
};

export const updateSearchResultsWithIcon = ( searchResponse, svgIconFile ) => {
    var schIconName = svgIconFile ? svgIconFile : 'typeFile48.svg';

    var imageIconUrl = iconSvc.getTypeIconFileUrl( schIconName );
    var searchResults = _.clone( searchResponse.searchResults );
    _.forEach( searchResults, function( vmoSch ) {
        vmoSch.thumbnailURL = imageIconUrl;
        vmoSch.hasThumbnail = true;
    } );
    return searchResults;
};

export let updateHealthInfo = function( searchState, gridSelection ) {
    let searchStateData = { ...searchState.value };
    var deviceName = gridSelection.length > 0 ? gridSelection[0].props.MeasDevice.dbValue : '';
    var deviceId = gridSelection.length > 0 ? gridSelection[0].props.MeasDeviceID.dbValue : '';
    var plantName = gridSelection.length > 0 ? gridSelection[0].props.PlantName.dbValue : '';
    var fileType = gridSelection.length > 0 ? 0 : -1;
    var failedCount = gridSelection.length > 0 ? gridSelection[0].props.TotalFilesFailedFolder.dbValue : -1;
    var successCount = gridSelection.length > 0 ? gridSelection[0].props.TotalFilesSuccessFolder.dbValue : -1;
    var partialSuccessCount = gridSelection.length > 0 ? gridSelection[0].props.TotalFilesPartialSuccessFolder.dbValue : -1;

    if( searchStateData.healthInfo ) {
        searchStateData.healthInfo.deviceName = deviceName;
        searchStateData.healthInfo.deviceId = deviceId;
        searchStateData.healthInfo.plantName = plantName;
        searchStateData.healthInfo.fileType = fileType;
        searchStateData.healthInfo.failedCount = failedCount;
        searchStateData.healthInfo.successCount = successCount;
        searchStateData.healthInfo.partialSuccessCount = partialSuccessCount;
        searchStateData.healthInfo.selectedFileReports = [];
    } else {
        const healthInfo = {
            deviceName: deviceName,
            deviceId: deviceId,
            plantName: plantName,
            failedCount: failedCount,
            successCount: successCount,
            partialSuccessCount: partialSuccessCount,
            selectedFileReports: [],
            fileType: fileType
        };
        searchStateData.healthInfo = healthInfo;
    }
    searchState.update( { ...searchStateData } );
};

export let updateFileType = function( searchState, pieSelection ) {
    let searchStateData = { ...searchState.value };
    searchStateData.healthInfo.fileType = pieSelection ? Number( pieSelection.xValue ) : 0;
    searchState.update( { ...searchStateData } );
};

export let openFile = function( selectedFileReport, fileType ) {
    var deferred = AwPromiseService.instance.defer();
    var filePath = '';
    if ( fileType === 'dml' ) {
        filePath = selectedFileReport.props.DMLFile.dbValue;
    } else if ( fileType === 'error' ) {
        filePath = selectedFileReport.props.ErrorFile.dbValue;
    } else if ( fileType === 'warn' ) {
        filePath = selectedFileReport.props.WarningFile.dbValue;
    } else if ( fileType === 'data' ) {
        filePath = selectedFileReport.props.DataFile.dbValue;
    }
    if( filePath ) {
        var url = browserUtils.getBaseURL() + 'tc/micro/dpvservice/etl/operation/download?ds=' + filePath;
        window.open( url, '_blank' );
    }
    deferred.resolve( null );
    return deferred.promise;
};

export let openConfigFile = function( vmo ) {
    var deferred = AwPromiseService.instance.defer();
    var url = vmo.props.ConfigurationXML.dbValue;
    window.open( url, '_blank' );
    deferred.resolve( null );
    return deferred.promise;
};

export let updateFileReportInfo = function( data, searchState ) {
    let dataCopy = _.cloneDeep( data );
    let fileType = searchState.healthInfo.fileType;
    var isSingleFileSelected = searchState.healthInfo.selectedFileReports && searchState.healthInfo.selectedFileReports.length === 1;

    var fileName = isSingleFileSelected ? getFilenameFromPath( searchState.healthInfo.selectedFileReports[0].props.DataFile.dbValue ) : '';
    dataCopy.dataFileLink.displayName = fileName;
    dataCopy.dataFileLink.uiValue = dataCopy.dataFileLink.displayName;
    dataCopy.dataFileLink.uiValues[0] = dataCopy.dataFileLink.displayName;

    if ( fileType === 0 ) {
        fileName = isSingleFileSelected ? getFilenameFromPath( searchState.healthInfo.selectedFileReports[0].props.DMLFile.dbValue ) : '';
        dataCopy.dmlFileLink.displayName = fileName;
        dataCopy.dmlFileLink.uiValue = dataCopy.dmlFileLink.displayName;
        dataCopy.dmlFileLink.uiValues[0] = dataCopy.dmlFileLink.displayName;
        fileName = isSingleFileSelected ? getFilenameFromPath( searchState.healthInfo.selectedFileReports[0].props.ErrorFile.dbValue ) : '';
        dataCopy.errorFileLink.displayName = fileName;
        dataCopy.errorFileLink.uiValue = dataCopy.errorFileLink.displayName;
        dataCopy.errorFileLink.uiValues[0] = dataCopy.errorFileLink.displayName;
    } else if ( fileType === 2 ) {
        fileName = isSingleFileSelected ? getFilenameFromPath( searchState.healthInfo.selectedFileReports[0].props.WarningFile.dbValue ) : '';
        dataCopy.warnFileLink.displayName = fileName;
        dataCopy.warnFileLink.uiValue = dataCopy.warnFileLink.displayName;
        dataCopy.warnFileLink.uiValues[0] = dataCopy.warnFileLink.displayName;
    }
    return {
        dmlFileLink: dataCopy.dmlFileLink,
        errorFileLink: dataCopy.errorFileLink,
        dataFileLink: dataCopy.dataFileLink,
        warnFileLink: dataCopy.warnFileLink
    };
};

export let updateFileReport = function( selection, searchState ) {
    let searchData = { ...searchState.value };
    searchData.healthInfo.selectedFileReports = selection;
    searchState.update( { ...searchData } );
};

export let selectTableRow = function( searchState, dataProvider ) {
    if ( searchState.healthInfo && searchState.healthInfo.plantName ) {
        var loadedObjects = dataProvider.viewModelCollection.loadedVMObjects;
        var selection = loadedObjects.filter( function( element ) {
            return  element.props.PlantName.dbValue === searchState.healthInfo.plantName &&
                element.props.MeasDeviceID.dbValue === searchState.healthInfo.deviceId;
        } );
        dataProvider.selectionModel.setSelection( selection );
    }
};

export let reprocessFiles = function( searchState ) {
    var deferred = AwPromiseService.instance.defer();
    var targetURL = browserUtils.getBaseURL() + 'tc/micro/dpvservice/etl/operation/dashboard/files';

    var filesInfo = [];
    _.forEach( searchState.healthInfo.selectedFileReports, function( selectedFile ) {
        filesInfo.push( selectedFile.props.DataFile.dbValue );
    } );

    var $http = AwHttpService.instance;
    var postPromise = $http.put( targetURL, filesInfo );
    postPromise.then( function( response ) {
        deferred.resolve( response );
    }, function( err ) {
        deferred.reject( err );
    } );
    return deferred.promise;
};

export let deleteFiles = function( searchState ) {
    var deferred = AwPromiseService.instance.defer();
    var $http = AwHttpService.instance;
    var targetURL = browserUtils.getBaseURL() + 'tc/micro/dpvservice/etl/operation/dashboard/files/delete';

    var filesInfo = [];
    _.forEach( searchState.healthInfo.selectedFileReports, function( selectedFile ) {
        filesInfo.push( selectedFile.props.DataFile.dbValue );
    } );

    var postPromise = $http.put( targetURL, filesInfo );
    postPromise.then( function( response ) {
        deferred.resolve( response );
    }, function( err ) {
        deferred.reject( err );
    } );
    return deferred.promise;
};

export let populateError = function( response ) {
    var message = '';
    if ( response.Errors && response.Errors.length > 0 ) {
        message = response.Errors[0];
    }
    return message;
};

function getFilenameFromPath( filePath ) {
    var fileName = filePath;
    let lastInd = filePath.lastIndexOf( '/' );
    if( lastInd > -1 ) {
        fileName = fileName.substring( lastInd + 1 );
    }
    return fileName;
}

export default exports = {
    loadHealthReportData,
    loadFailedFiles,
    loadSuccessFiles,
    loadPartialSuccessFiles,
    createFilesPieChart,
    updateSearchResultsWithIcon,
    updateHealthInfo,
    updateFileType,
    openFile,
    openConfigFile,
    updateFileReportInfo,
    updateFileReport,
    selectTableRow,
    reprocessFiles,
    deleteFiles,
    populateError
};
