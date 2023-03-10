// Copyright (c) 2022 Siemens

/**
 * @module js/Pgp0TimelineSearchService
 */

import _ from 'lodash';
import appCtxSvc from 'js/appCtxService';
import awTableStateService from 'js/awTableStateService';
import cdm from 'soa/kernel/clientDataModel';
import cmm from 'soa/kernel/clientMetaModel';
import eventBus from 'js/eventBus';
import vmcs from 'js/viewModelObjectService';

/**
 * Select the provided object in dataProvider
 *
 * @param {object} data - Data object
 */
export let selectObjectInList = function( dataProvider, objectToSelect ) {
    if( dataProvider && objectToSelect ) {
        var index = dataProvider.viewModelCollection.findViewModelObjectById( objectToSelect.uid );
        if( index > -1 ) {
            var vmo = dataProvider.viewModelCollection.getViewModelObject( index );
            dataProvider.selectionModel.setSelection( vmo );
        }
    }
};

export let constructDeliverableEventObjects = function( response, i18n ) {
    let searchResultsArr = [];
    // Check if response is not null and it has some search results then iterate for each result to formulate the
    // correct response
    if( response && response.searchResults ) {
        let delInstanceObj = {};
        for( let i = 0; i < response.searchResults.length; i++ ) {
            // Get the model object for search result object UID present in response
            let resultObject = cdm.getObject( response.searchResults[ i ].uid );
            //If the object is not Event type , then its a Deliverable Instance
            //Set the Deliverable so as to add its properties to dummy object
            if( !cmm.isInstanceOf( 'Prg0AbsEvent', resultObject.modelType ) ) {
                delInstanceObj = resultObject;
            } else {
                let props = [];
                let newObj = vmcs.createViewModelObject( delInstanceObj.uid );
                //Update the UID to store EventUID for highlighting the event
                newObj.uid = resultObject.uid;
                //Set Cell Properties
                let cellHeader1 = delInstanceObj.props.object_name.uiValues[ 0 ];
                props.push( String( i18n.objectName ) + '\\:' + cellHeader1 );
                //For objects that have item_id , it should be shown else its type should be shown
                if( delInstanceObj.props.item_id ) {
                    let cellHeader2 = delInstanceObj.props.item_id.uiValues[ 0 ];
                    props.push( String( i18n.ID ) + '\\:' + cellHeader2 );
                } else {
                    let cellHeader2 = '';
                    props.push( 'cellHeader2 \\:' + cellHeader2 );

                    let cellProp1 = delInstanceObj.type;
                    props.push( String( i18n.type ) + '\\:' + cellProp1 );
                }
                let cellProp2 = resultObject.props.object_name.uiValues[ 0 ];
                props.push( String( i18n.Pgp0Event ) + '\\:' + cellProp2 );

                if( props ) {
                    newObj.props.awp0CellProperties.dbValue = props;
                    newObj.props.awp0CellProperties.dbValues = props;
                    newObj.props.awp0CellProperties.uiValue = props;
                    newObj.props.awp0CellProperties.uiValues = props;
                }

                newObj.cellProperties = {};
                //Index is set to 2 as 0 and 1 are cellHeaders
                for( let idx = 2; idx < props.length; idx++ ) {
                    let keyValue = props[ idx ].split( '\\:' );
                    let key = keyValue[ 0 ];
                    let value = keyValue[ 1 ] || '';
                    newObj.cellProperties[ key ] = {
                        key: key,
                        value: value
                    };
                }
                searchResultsArr.push( newObj );
            }
        }
    }

    return {
        searchResults: searchResultsArr,
        totalFound: searchResultsArr.length,
        totalLoaded: searchResultsArr.length
    };
};

/**
 * Getting Last Index.
 * To update the last index of the Psi0PrgDelSearchProvider
 *
 * @param {startIndex} startIndex - startIndex of the results
 * @param {data} data - Data
 */
export let getLastIndex = function( startIndex, data ) {
    let lastIndex = 0;
    if( startIndex > 0 && data.lastEndIndex ) {
        //it's a scrolling case
        lastIndex = data.lastEndIndex.toString();
    }
    return lastIndex;
};

/**
 * This function fires event on the basis of value in Timeline Find listbox.
 * @param {data} data
 */
export let getSearchByType = function( timelineSearchByVal ) {
    appCtxSvc.registerCtx( 'timelineSearchBy', '' );
    if( timelineSearchByVal === 'Event' ) {
        appCtxSvc.updateCtx( 'timelineSearchBy', 'Event' );
    } else {
        appCtxSvc.updateCtx( 'timelineSearchBy', 'DelInstances' );
    }
    eventBus.publish( 'getEventsInformationForFilteredResult' );
};

/**
 *
 * @param {data} data - SOA results
 *
 * It checks which parent plan object of the selected object is present in loadedVMOOjects or not.
 * Plan object found is then used to trigger the expansion until immediate plan object is loaded.
 *
 */
export let checkForParentAndExpand = function( data ) {
    if( data && data.searchResults ) {
        let loadedObjs = data.dataProviders.planNavigationTreeDataProvider.viewModelCollection.loadedVMObjects;
        let expandedIndex;
        let eventPlanObjectIndex = data.searchResults.length - 2;
        //Iterate through loadedVMO to check which parent is loaded
        for( let i = data.searchResults.length - 1; i >= 0; i-- ) {
            let index = _.findIndex( loadedObjs, function( obj ) {
                return obj.uid === data.searchResults[ i ].uid;
            } );
            if( index > -1 ) {
                //Store the index of parent node that is founded in loaded objects
                expandedIndex = i;
                break;
            }
        }
        //Expand until events's immediate Plan object is expanded so that the event can be highlighted
        for( let j = expandedIndex; j <= eventPlanObjectIndex; j++ ) {
            let nodeToExpand = data.searchResults[ j ];
            if( nodeToExpand.isExpanded === undefined || nodeToExpand.isExpanded === false ) {
                eventBus.publish( data.dataProviders.planNavigationTreeDataProvider.name + '.expandTreeNode', {
                    parentNode: {
                        id: nodeToExpand.uid
                    }
                } );
            }
            let gridId = Object.keys( data.grids )[ 0 ];
            awTableStateService.saveRowExpanded( data, gridId, nodeToExpand );
        }
    }
};

/**
 * It gives string of filtered plan uids separated by commas(,)
 * @param {data} data
 */
export let getFilteredPlanLevelsInput = function( dataProvider ) {
    let planUidString = '';
    if( appCtxSvc.getCtx( 'isColumnFilteringApplied' ) ) {
        let loadedObjs = dataProvider.viewModelCollection.loadedVMObjects;
        for( let idx = 0; idx < loadedObjs.length; idx++ ) {
            planUidString += loadedObjs[ idx ].uid + ',';
        }
        planUidString = planUidString.substring( 0, planUidString.length - 1 );
    }
    if( appCtxSvc.getCtx( 'timelineSearchBy' ) === 'Event' ) {
        eventBus.publish( 'getEventsInformation', planUidString );
    } else {
        eventBus.publish( 'getDelInstancesInformation', planUidString );
    }
};

/**
 * Method that:
 * a) Resets the result string everytime dropdown selection changes
 * b) Clears Events result when Del Instance searched for and vice-versa
 * It is done so that if drop down selecton changes previous search results are cleared
 *
 * @param {data} data - Contains the data providers result
 */
export let clearDataProviderResults = function( data ) {
    if( data.resultString && data.resultString.dbValue ) {
        data.resultString.dbValue = '';
    }
    if( data.timelineSearchBy.dbValue === 'Event' ) {
        data.dataProviders.Psi0PrgDelSearchProvider.viewModelCollection.clear();
    } else {
        data.dataProviders.pgp0PlanObjsSearchProvider.viewModelCollection.clear();
    }
};

/**
 * Method to build the search result string that shows the count
 * E.g.: (4 Results)
 *
 * @param {data} data - Contains the data providers result
 */
export let buildResultString = function( searchResultLength, i18nResultStr ) {
    return '(' + searchResultLength + ' ' + i18nResultStr + ')';
};

/**
 * Method to unregister the variable in ctx after ViewModel is unloaded.
 *
 * @param {object} ctx - Context object
 */
export let clearCtxForEventHighlight = function( ctx ) {
    appCtxSvc.unRegisterCtx( 'populateEventData' );
    appCtxSvc.unRegisterCtx( 'timelineSearchBy' );
};

/**
 * Method to store selective parameters returned by data provider in ctx for further processing.
 *
 * @param {object} data - Data object
 */
export let populateCtxForEventHighlight = function( data ) {
    appCtxSvc.registerCtx( 'populateEventData', {} );
    var searchResultsArr = [];
    if( data.searchResults ) {
        for( var i = 0; i < data.searchResults.length; i++ ) {
            searchResultsArr.push( data.searchResults[ i ].uid );
        }
    }
    var populateEventData = appCtxSvc.getCtx( 'populateEventData' );
    populateEventData.dataProvider = data.dataProviders.pgp0PlanObjsSearchProvider;
    populateEventData.searchResults = searchResultsArr;
    if( appCtxSvc.ctx.populateEventData ) {
        appCtxSvc.updateCtx( 'populateEventData', populateEventData );
    }
};

let exports = {
    selectObjectInList,
    constructDeliverableEventObjects,
    getLastIndex,
    getSearchByType,
    checkForParentAndExpand,
    getFilteredPlanLevelsInput,
    clearDataProviderResults,
    buildResultString,
    clearCtxForEventHighlight,
    populateCtxForEventHighlight
};
export default exports;
