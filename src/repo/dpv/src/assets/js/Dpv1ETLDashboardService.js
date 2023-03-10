// Copyright (c) 2022 Siemens
/**
 * @module js/Dpv1ETLDashboardService
 */
 import AwHttpService from 'js/awHttpService';
 import AwPromiseService from 'js/awPromiseService';
 import browserUtils from 'js/browserUtils';
 import iconSvc from 'js/iconService';
 import propertyPolicySvc from 'soa/kernel/propertyPolicyService';
 import soaSvc from 'soa/kernel/soaService';
 import _ from 'lodash';
 import logger from 'js/logger';
 import _localeSvc from 'js/localeService';
 var exports = {};

 export const initSearchState = async( searchStateAtomicDataRef, searchStateUpdater ) => {
     let searchState = searchStateAtomicDataRef.getAtomicData();
     let newSearchstate = searchState ? { ...searchState } : undefined;
     const healthInfo = {
         "deviceName": "",
         "deviceId": "",
         "plantName": "",
         "failedCount": -1,
         "successCount": -1,
         "partialSuccessCount": -1,
         "selectedFileReports": [],
         "fileType": -1
     };
     const deviceAgentInfo = {
         "plantId": "",
         "deviceAgent": "",
         "plantName": "",
         "selectedStatOption": "hourly",
         "showGraph": true
     };
     if( newSearchstate ) {
         newSearchstate.selectedPlants = [];
         newSearchstate.healthInfo = healthInfo;
         newSearchstate.deviceAgentInfo = deviceAgentInfo;
         searchStateUpdater.searchState( newSearchstate );
     }
 };

export let loadETLOverviewData = function(){
    var deferred = AwPromiseService.instance.defer();
    var $http = AwHttpService.instance;
    //fetch PlantNames

    var policyJson = {
        types: [
            {
                name: 'MEPrPlantProcessRevision',
                properties: [
                    {
                        name: 'item_id'
                    },
                    {
                        name: 'object_name'
                    }
                ]
            }
        ]
    };
    var searchCriteria = {
        Type : 'MEPrPlantProcessRevision',
        object_name: '*',
        queryName : 'Item Revision...',
        typeOfSearch : 'ADVANCED_SEARCH',
        lastEndIndex : '',
        OwningUser : '*',
        OwningGroup : '*',
        option : 'allTemplates',
        displayMode: 'Table'
    };
    var inputData = {
        columnConfigInput: '',
        searchInput: {
            maxToLoad: 50,
            maxToReturn: 50,
            providerName: 'Awp0SavedQuerySearchProvider',
            searchCriteria: searchCriteria,
            cursor: {},
            searchFilterFieldSortType: 'Alphabetical',
            searchFilterMap6: {}
        },
        saveColumnConfigData: null,
        inflateProperties: true
    };
    var plantNames= [];
    var plantNametoIDMap = new Map();
    var policyId = propertyPolicySvc.register( policyJson );
    soaSvc.postUnchecked( 'Internal-AWS2-2019-06-Finder', 'performSearchViewModel4', inputData ).then(
        function( response ) {
            if ( policyId ) {
                propertyPolicySvc.unregister( policyId );
            }
            if( response.ServiceData.modelObjects ){
                var modelObjects = response.ServiceData.modelObjects; 
                for( var key in modelObjects ){
                    var modelObject = modelObjects[ key ];
                    if( modelObject.type === 'MEPrPlantProcessRevision' && modelObject.props ){
                        plantNames.push(modelObject.props.object_name.dbValues[ 0 ]);
                        plantNametoIDMap.set( modelObject.props.object_name.dbValues[0], modelObject.props.item_id.dbValues[0]);
                    }
                }
            }
            if(plantNames.length > 0){
                var searchCriteriaPost = {        
                    "availability" : 95.5,
                    "plants" : plantNames
                };
                 var searchInputPost = {
                    searchCriteria : searchCriteriaPost,
                    StartIndex : 0,
                    MaxToReturn : 50,
                    cursor: {},
                    searchFilterFieldSortType: 'Alphabetical',
                    searchFilterMap6: {}
                };
            
                var launchInfoInput = {
                    "searchInput" : searchInputPost
                };
                var totalFound=0;
                var outputData;        
                var targetURL = browserUtils.getBaseURL() + "tc/micro/dpvservice/etl/operation/dashboard/overview";         
                var postPromise = $http.post(targetURL, launchInfoInput);
                postPromise.then(function (response) {
                    if ( response && response.data && response.data.Data ){                    
                        totalFound = response.data.Data.totalFound;
                        if(totalFound >0){
                            outputData= {
                                "totalFound": totalFound,
                                "searchResults": updateResultWithPlanId(response.data.Data.searchResults, plantNametoIDMap)           
                            };
                            deferred.resolve(outputData);   
                        }
                    } else {
                        logger.error("ELT Dashboard Overview : Invalid Response.");
                    }
                }, function (err) {
                    deferred.reject(err);
                });
            }
        } );
        return deferred.promise;
};

function updateResultWithPlanId( searchResults, plantNametoIDMap  ) {
    _.forEach( searchResults, function( obj ) {
        obj.PlantId = plantNametoIDMap.get(obj.PlantName);
    });
    return searchResults;
}

export let updatePlantSelection = function (searchState, selection) {
    const healthInfo = {
        "deviceName": "",
        "deviceId": "",
        "plantName": "",
        "failedCount": -1,
        "successCount": -1,
        "partialSuccessCount": -1,
        "selectedFileReports": [],
        "fileType": -1
    };
    const deviceAgentInfo = {
        "plantId": "",
        "deviceAgent": "",
        "plantName": "",
        "selectedStatOption": "hourly",
        "showGraph": true
    };
    let searchStateData = { ...searchState.value };
    searchStateData.selectedPlants = selection;
    //reset healthInfo and deviceAgentInfo on plant selection
    searchStateData.healthInfo = healthInfo;
    searchStateData.deviceAgentInfo = deviceAgentInfo;

    searchState.update({ ...searchStateData });
};

export let selectTableRows = function (searchState, dataProvider) {
    if (searchState.selectedPlants && searchState.selectedPlants.length > 0) {
        var loadedObjects = dataProvider.viewModelCollection.loadedVMObjects;
        var selection = [];

        _.forEach(searchState.selectedPlants, function (selPlant) {
            var filteredPlant = loadedObjects.filter(function (vmo) {
                return vmo.props.PlantId.dbValue === selPlant.props.PlantId.dbValue;
            });
            selection.push.apply(selection, filteredPlant);
        });
        dataProvider.selectionModel.setSelection(selection);
    }
};

export let createFilesPieChart = function ( selectedPlants ) {
    var arrayOfSeriesDataForChart = [];

    var keyValueDataForChart = [];
    let countFailed = -1;
    let countSuccess = -1;
    let countPartialSuccess = -1;

    if(selectedPlants && selectedPlants.length>0) {
        countFailed = 0;
        countSuccess = 0;
        countPartialSuccess = 0;

        _.forEach( selectedPlants, function( plant ) {
            countFailed += plant.props.TotalFilesFailedFolder.dbValue;
            countSuccess += plant.props.TotalFilesSuccessFolder.dbValue;
            countPartialSuccess += plant.props.TotalFilesPartialSuccessFolder.dbValue;
        });
    }
    
    keyValueDataForChart.push({
        label: '0',
        value: countFailed,
        name: 'Failed',
        y: countFailed
    });

    keyValueDataForChart.push({
        label: '1',
        value: countSuccess,
        name: 'Success',
        y: countSuccess
    });

    keyValueDataForChart.push({
        label: '2',
        value: countPartialSuccess,
        name: 'Partial Success',
        y: countPartialSuccess
    });

    arrayOfSeriesDataForChart.push({
        seriesName: 'Files in Folders',
        keyValueDataForChart: keyValueDataForChart
    });
    return arrayOfSeriesDataForChart;
};

export function getValueInViewModel( value ) {
    return value;
}

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
    initSearchState,
    loadETLOverviewData,
    updatePlantSelection,
    selectTableRows,
    createFilesPieChart,
    getValueInViewModel,
    updateSearchResultsWithIcon  
};