// Copyright 2020 Siemens Product Lifecycle Management Software Inc.

/*global*/

/**
 * @module js/studyTableService
 */
import _ from 'lodash';
import _localeService from 'js/localeService';
import { constants as epSaveConstants } from 'js/epSaveConstants';
import awColumnSvc from 'js/awColumnService';
let studyAndStudySCMap = new Map();
import vmoService from 'js/viewModelObjectService';

let processResponse = function( response ) {
    let findStudiesOutput = response.findStudiesOutput;
    let filteredResponse = [];
    if( findStudiesOutput && findStudiesOutput.length > 0 ) {
        _.forEach( findStudiesOutput[ 0 ].results, function( result ) {
            if( result.study && result.studySC ) {
                studyAndStudySCMap.set( result.study.uid, result.studySC );
                filteredResponse.push( result.study );
            }
        } );
    }
    return filteredResponse;
};

let getTotalFound = function( response ) {
    if( response.findStudiesOutput && response.findStudiesOutput.length > 0 ) {
        return response.findStudiesOutput[ 0 ].totalFound;
    }
    return 0;
};

let getStartFrom = function( viewModelCollection, startIndex ) {
    let startFromObj = {
        uid: 'AAAAAAAAAAAAAA',
        type: 'unknownType'
    };
    if( startIndex !== 0 ) {
        let lastRowObj = viewModelCollection.getViewModelObject( startIndex - 1 );

        startFromObj.uid = lastRowObj.uid;
        startFromObj.type = lastRowObj.type;
    }
    return startFromObj;
};

let getSortField = function( sortCriteria ) {
    if( sortCriteria && sortCriteria[ 0 ].fieldName ) {
        return sortCriteria[ 0 ].fieldName;
    }
    return '';
};

let isAscending = function( sortCriteria ) {
    if( sortCriteria && sortCriteria[ 0 ].sortDirection === 'ASC' ) {
        return true;
    }
    return false;
};

let getFilterMap = function( columnFilters ) {
    if( columnFilters ) {
        let filterMap = {};
        _.forEach( columnFilters, function( columnFilter ) {
            filterMap[ columnFilter.columnName ] = columnFilter.values[ 0 ];
        } );
        return filterMap;
    }
    return {};
};

/**
 *
 * @param {String/Array} selection - selected study uid/ selected studies
 * @returns {Object/Array} study structure context of selected study/ selected studies
 */
function getSCOfSelectedStudy( selection ) {
    if( selection instanceof Array ) {
        let studySC = [];
        for( let study of selection ) {
            studySC.push( studyAndStudySCMap.get( study.uid ) );
        }
        return studySC;
    }
    return studyAndStudySCMap.get( selection );
}

let updateSelectedStudy = function( subPanelContext, tableSelectedObjects ) {
    const newObj = { ...subPanelContext.studyManagerContext.getValue() };
    newObj.selection = tableSelectedObjects;
    subPanelContext.studyManagerContext.update( newObj );
};

/**
 * adds/deletes Study and study Sc mapping and also updated the selection
 * @param {Object} eventData - eventData
 *  @param {Object} subPanelContext - subPanelContext
 * @param {Object} data - data
 * @returns {string} totalFound -
 */
function updateStudySCAndSelection( eventData, subPanelContext, data ) {
    const relatedEvents = eventData.relatedEvents;
    const objUidToRemoveList = relatedEvents[ epSaveConstants.REMOVED_FROM_RELATION ];
    const objUidToAddList = relatedEvents[ epSaveConstants.ADDED_TO_RELATION ];
    if( objUidToRemoveList && objUidToRemoveList.length > 0 ) {
        for( let uid of objUidToRemoveList ) {
            studyAndStudySCMap.delete( uid );
            data.searchResults.pop();
        }
        data.totalFound -= objUidToRemoveList.length;
    }
    if( objUidToAddList && objUidToAddList.length > 0 ) {
        for( let index = 0; index < objUidToAddList.length; index++ ) {
            studyAndStudySCMap.set( objUidToAddList[ index ], eventData.studySC[ index ] );
            data.searchResults.push( vmoService.createViewModelObject( objUidToAddList[ index ] ) );
        }
        data.totalFound += objUidToAddList.length;
    }
    data.dataProviders.studyTableDataProvider.viewModelCollection.totalFound = data.totalFound;
    updateSelectedStudy( subPanelContext, data.dataProviders.studyTableDataProvider.getSelectedObjects() );
    return data.totalFound;
}
/**
 * this function adds icon column just before name column if present
 *
 * @param {Object} columns - table columns
 */
function addIconColumn( columns ) {
    let iconColumnFound = false;

    let iconColumnIndex = -1;
    for( let i = 0; i < columns.length; i++ ) {
        let colInfo = columns[ i ];
        if( colInfo.name === 'icon' ) {
            iconColumnFound = true;
        } else if( colInfo.name === 'object_name' ) {
            iconColumnIndex = i;
            break;
        }
    }

    if( !iconColumnFound && iconColumnIndex !== -1 ) {
        // Setup the special icon column
        let newColumnInfo = awColumnSvc.createColumnInfo( {

            name: 'icon',
            displayName: '',
            width: 34,
            enableColumnMoving: false,
            enableColumnMenu: false,
            enableColumnResizing: false,
            isFilteringEnabled: false,
            enableSorting: false,
            visible: true,
            pinnedLeft: false
        } );

        columns.splice( iconColumnIndex, 0, newColumnInfo );
    }
}
/**
 * updates cc and scopes based on synced input object
 *
 * @param {Object} viewModelData the ViewModel data
 * @param {Object} newInput the new Input
 * @returns {Object} -
 */
function handleNewInput( viewModelData, newInput ) {
    viewModelData.isInputObjectUpdated = false;
    if( !newInput || !( newInput.cc || newInput.selectedCC ) ) {
        //Framework sends null object while intializing sync strategy
        return;
    }
    if( newInput === '' ) {
        // unmount case - framework is sending empty string
        // we don't want to set this new input in the input object
        // we return and the next actions in the view model can continue using old input.
        return;
    }
    let cc = null;
    if( newInput.cc ) {
        cc = newInput.cc;
    } else { cc = newInput.selectedCC; }
    let scopes = newInput.scopes;

    if( viewModelData.inputObject && cc.uid === viewModelData.inputObject.uid && areScopesEqual( viewModelData, scopes ) ) {
        return {
            inputObject: viewModelData.inputObject,
            scopes: viewModelData.scopes,
            isInputObjectUpdated: false
        };
    }
    return {
        inputObject: cc,
        scopes: scopes,
        isInputObjectUpdated: true
    };
}

/**
 * updates scopes based on synced input object
 *
 * @param {Object} viewModelData the ViewModel data
 * @param {Array} scopes the new Scopes
 * @returns {Boolean} if scope is changed
 */
function areScopesEqual( viewModelData, scopes ) {
    //if scopes are not defined then initialize with empty array to avoid complex check for equality
    if( !viewModelData.scopes ) {
        viewModelData.scopes = [];
    }
    //empty scopes are sent from sync object
    if( scopes.length === 0 && viewModelData.scopes.length === 0 ) {
        //new and old scopes are both empty arrays
        return true;
    }
    if( viewModelData.scopes.length !== scopes.length || viewModelData.scopes[0].uid !== scopes[0].uid ) {
        //new and old scope array sizes or elements are different
        return false;
    }
    return true;
}

/**
 * String representing the studies fetch v/s total found
 *
 * @param {Object} searchResults - searchResults recieved from server
 * @param {number} totalFound - total number of objects found
 * @param {number} startIndex - startIndex of searchResults
 * @param {Object} columnFilters - coulmn filters
 * @returns {String} number of studies fetched v/s total studies else returns empty string
 */
export function updateStudyCount( searchResults, totalFound, startIndex, columnFilters ) {
    return _localeService
        .getTextPromise( 'tcmaStudyManagerMessages' )
        .then(
            function( messageBundle ) {
                let str = messageBundle.studyResultMessage;

                if( totalFound > 0 ) {
                    if( startIndex + searchResults.length > totalFound ) {
                        str = str.format( totalFound, totalFound );
                    } else {
                        str = str.format( startIndex +
                            searchResults.length, totalFound );
                    }
                } else if( columnFilters ) { //show table to enable user to change filter options
                    str = messageBundle.noResultsFoundMessage;
                } else {
                    str = '';
                }
                return str;
            } );
}

export default {
    processResponse,
    getTotalFound,
    getStartFrom,
    getSortField,
    isAscending,
    getFilterMap,
    getSCOfSelectedStudy,
    updateSelectedStudy,
    updateStudySCAndSelection,
    addIconColumn,
    handleNewInput,
    updateStudyCount
};
