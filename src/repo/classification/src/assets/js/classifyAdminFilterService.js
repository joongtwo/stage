/* eslint-disable max-lines */
// Copyright (c) 2022 Siemens

/**
 * This is a utility for admin filter services
 *
 * @module js/classifyAdminFilterService
 */
import appCtxService from 'js/appCtxService';
import localeSvc from 'js/localeService';
import AwTimeoutService from 'js/awTimeoutService';
import _ from 'lodash';

var exports = {};
var _timeout = null;

var locale = localeSvc.getLocale();
if( locale.length === 2 ) {
    // SSO needs the 5 character locale, so "special case" the supported locales
    switch ( locale ) {
        case 'en':
            locale = 'en_US';
            break;
        case 'es':
            locale = 'es_ES';
            break;
        case 'de':
            locale = 'de_DE';
            break;
        case 'fr':
            locale = 'fr_FR';
            break;
        case 'it':
            locale = 'it_IT';
            break;
        default:
            // do nothing
            break;
    }
}

/**
 * This method is used to get the preference values for the CLS_CST_supported_eclass_releases preference.
 * @param {Object} response the response of the getPreferences soa
 * @returns {Object} preference values
 */
export let getReleasePreferenceValues = function( response ) {
    var prefs = [];

    var preferences = response.preferences;
    if( preferences.length > 0 && preferences[ 0 ].values ) {
        for( var idx = 0; idx < preferences[ 0 ].values.length - 1; idx++ ) {
            var pref = {
                internalName: preferences[ 0 ].values[ idx ],
                displayName: preferences[ 0 ].values[ idx + 1 ]
            };
            idx += 1;
            prefs.push( pref );
        }
    }

    return prefs;
};


/**
 * Sets filterMap property of search context using current filters.
 * @param {Object} data data containing field to change and the new value.
 * @param {Object} searchState search state object
 * @param {Object} filterState state object
 * @return {Object} the updated filter state.
 */
export let setFilters = function( data, searchState, filterState ) {
    let filterMap = [];
    if( data && data.appliedFilterDetails && data.appliedFilterDetails.dbValue ) {
        for( var filter of data.appliedFilterDetails.dbValue ) {
            if( filter.operationValues && filter.operationValues.dbValue !== null ) {
                filterMap.push( [ filter.operationType.dbValue, filter.operationValues.dbValue ] );
            }
        }
    }

    let releases = {};
    if( data && data.releasesState ) {
        releases = data.releasesState;
    }

    var tmpState = { ...searchState.value };
    //if curent filters are removed, flag
    tmpState.noFilters = tmpState.filterMap && tmpState.filterMap.length > 0 && filterMap.length === 0;
    tmpState.filterMap = filterMap;
    tmpState.releases = releases;
    tmpState.clsFilters = {
        filterMap: filterMap,
        releases: releases,
        appliedFilters: data.appliedFilterDetails
    };
    searchState.searchString = '';
    searchState.update( tmpState );
    filterState.showApplyFilters = false;
    return filterState;
};

/**
 * Update selected releases
 *
 * @param {ViewModelProperty} prop - ViewModelProperty,
 * @param {Object} adminCtx admin context
 */
export let updateSelectedReleases = function( prop, adminCtx ) {
    let isValid = true;
    if( prop.propApi.validationApi ) {
        isValid = prop.propApi.validationApi( prop.dbValue );
    }
    if( isValid ) {
        adminCtx.releases.selected = adminCtx.releases.expandedList;
        // var prefs = prop.dbValue.split( ', ' );
        _.forEach( adminCtx.releases.selected, function( release ) {
            release.selected = 'false';
        } );
        _.forEach( prop.dbValue, function( pref ) {
            var jdx = _.findIndex( adminCtx.releases.selected, function( release ) {
                return release.internalName === pref;
            } );
            adminCtx.releases.selected[ jdx ].selected = 'true';
        } );
    }
};

/**
 * Reset selected releases to original list
 *
 * @param {Object} data - the view model
 */
export let resetReleases = function( data ) {
    getReleasesExpanded( data.Releases, true );
};

/**
 * Add releases from preferences to LOV
 *
 * @param {ViewModelProperty} prop - the view model property
 * @param {Boolean} reset true if reset, false otherwise
 */
export let getReleasesExpanded = function( prop, reset ) {
    var adminCtx = appCtxService.getCtx( 'clsAdmin' );
    var releasesExpandedList = [];
    if( !adminCtx.releases.expandedList || reset ) {
        _.forEach( adminCtx.releases.eReleases, function( release ) {
            var tmpProp = {
                internalName: release.internalName,
                displayName: release.displayName,
                selected: 'true'
            };
            releasesExpandedList.push( tmpProp );
        } );
        adminCtx.releases.expandedList = releasesExpandedList;
        appCtxService.updateCtx( 'clsAdmin', adminCtx );
    } else {
        releasesExpandedList = adminCtx.releases.expandedList;
    }

    var releasesSelected = _.filter( releasesExpandedList, function( o ) {
        return o.selected === 'true';
    } );
    adminCtx.releases.selected = releasesSelected;

    var db = [];
    var display = [];
    var displayStr = '';
    if( releasesExpandedList && releasesExpandedList.length > 0 ) {
        _.forEach( releasesExpandedList, function( release ) {
            if( release.selected === 'true' ) {
                db.push( release.internalName );
                display.push( release.displayName );
                displayStr += displayStr === '' ? '' : ', ';
                displayStr += release.displayName;
            }
        } );
    }

    prop.dbValue = db;
    prop.uiValues = display;
    prop.displayValues = display;
    prop.uiValue = displayStr;
};

/**
 * Creates initial list of releases
 *
 * @param {Object} data data
 */
export let createReleaseList = function( data ) {
    var prop = data.Releases;
    var adminCtx = appCtxService.getCtx( 'clsAdmin' );
    prop.propApi.fireValueChangeEvent = function() {
        exports.updateSelectedReleases( prop, adminCtx );
    };
    getReleasesExpanded( prop );
    prop.isArray = true;
    prop.lovApi = {};
    prop.lovApi.getInitialValues = function( filterStr, deferred ) {
        var lovEntries = [];
        _.forEach( adminCtx.releases.expandedList, function( release ) {
            let lovEntry = {
                propDisplayValue: release.displayName,
                propInternalValue: release.internalName,
                propDisplayDescription: '',
                hasChildren: false,
                children: {},
                sel: release.selected === 'true',
                disabled: false
            };
            lovEntries.push( lovEntry );
        } );
        return deferred.resolve( lovEntries );
    };

    prop.lovApi.getNextValues = function( deferred ) {
        deferred.resolve( null );
    };
    prop.lovApi.validateLOVValueSelections = function( lovEntries ) { // eslint-disable-line no-unused-vars
        // Either return a promise or don't return anything. In this case, we don't want to return anything
    };
    prop.hasLov = true;
    prop.isSelectOnly = true;
    prop.emptyLOVEntry = false;
    prop.resetEnabled = true;
};

/**
 * Adds new filter
 * @param {Object} data - The view model data
 * @param {Object} addFilterList - The list of filters to have a new one added to
 */
export let addFilter = function( data, addFilterList ) {
    addFilterList.dbValue.push( {
        operationType: _.clone( data.operationType, true ),
        operationValues: _.clone( data.operationValues, true ),
        operationTypeValues: data.operationTypeValues,
        showAnd: addFilterList.dbValue && addFilterList.dbValue.length ? addFilterList.dbValue.length > 0 : false,
        count: addFilterList.dbValue && addFilterList.dbValue.length ? addFilterList.dbValue.length : 0
    } );
};

/**
 * Method to Remove filter
 * @param {Object} data view model
 * @param {Object} provider data provider
 * @param {Object} vmo - selected filter cell
 * @param {Object} filterState filter state
 */
export let removeFilter = function( data, provider, vmo, filterState ) {
    let showAddFilter = filterState.value.showAddFilter;
    let showApplyFilters = filterState.value.showApplyFilters;
    var index = _.findIndex( data.addFilterList.dbValue, function( value ) {
        return value.operationType.dbValue === vmo.operationType.dbValue && value.operationValues.dbValue === vmo.operationValues.dbValue;
    } );

    let appliedFilterDetails = data.appliedFilterDetails;
    if ( appliedFilterDetails.dbValue.length > 1 ) {
        appliedFilterDetails.dbValue.splice( index, 1 );
        data.addFilterList.dbValue.splice( index, 1 );
        for ( var i = index; i < data.addFilterList.dbValue.length; i++ ) {
            data.addFilterList.dbValue[ i ].count = i;
            if ( i === 0 ) {
                data.addFilterList.dbValue[ i ].showAnd = false;
            }
        }
    } else {
        appliedFilterDetails.dbValue[ 0 ].operationValues.dbValue = '';
        showAddFilter = false;
        showApplyFilters = true;
    }
    const tmpContext = { ...filterState.value };
    tmpContext.showAddFilter = showAddFilter;
    tmpContext.showApplyFilters = showApplyFilters;
    tmpContext.filterRemoved = !tmpContext.filterRemoved;
    if( vmo.operationValues.dbValue ) {
        tmpContext.showApplyFilters = true;
    }
    filterState.update( tmpContext );
    provider.update( data.addFilterList.dbValue, data.addFilterList.dbValue.length );
};
/**
 * Initalize first filter box.
 * @param {*} data data to extract the filter box information from.
 */
export let revealFilterList = function( data ) {
    addFilter( data, data.addFilterList );
};

/**
 * Gather all the filter criteria(Property type and value).
 * @param {Object} data - The view model data
 * @param {Object} subPanelContext subpanel context
 */
export let addFilterListToParentView = function( data, subPanelContext ) {
    if( !_.isNull( _timeout ) ) {
        AwTimeoutService.instance.cancel( _timeout );
    }
    _timeout = AwTimeoutService.instance( function() {
        let showAddFilter = false;

        let appliedFilterDetails = [];
        if( data && data.operationValues && data.operationValues.dbValue !== null ) {
            let index = data.operationValues.index;
            appliedFilterDetails = data.subPanelContext.appliedFilterDetails.dbValue;
            if( appliedFilterDetails.length > index ) {
                appliedFilterDetails.splice( index, 1 );
                appliedFilterDetails.splice( index, 0, { operationValues: data.operationValues, operationType: data.operationType } );
            } else {
                appliedFilterDetails.splice( index, 0, { operationValues: data.operationValues, operationType: data.operationType } );
            }
        }
        let item = subPanelContext.item;
        item.operationType = data.operationType;
        item.operationValues = data.operationValues;

        _.forEach( appliedFilterDetails, function( filter ) {
            if( filter.operationValues && filter.operationValues.dbValue !== null && filter.operationValues.dbValue !== '' ) {
                showAddFilter = true;
            }
        } );

        const tmpContext = { ...subPanelContext.filterState.value };
        tmpContext.showAddFilter = showAddFilter;
        tmpContext.filterRemoved = !tmpContext.filterRemoved;
        if( item.operationValues ) {
            tmpContext.showApplyFilters = true;
        }
        subPanelContext.filterState.update( tmpContext );
    }, 500 );
};

/**
 * Initalize first filter box and text box in classification admin filter panel.
 * @param {*} subPanelContext subPanelContext
 * @returns {Object} Listbox, textbox list and type
 */
export let prepareList = function( subPanelContext ) {
    let item = { ...subPanelContext.item };
    let operationType = item.operationType;
    let operationTypeValues = item.operationTypeValues;
    let operationValues = item.operationValues;

    operationType.index = item.count;
    operationValues.index = item.count;

    return {
        operationType: operationType,
        operationTypeValues: operationTypeValues,
        operationValues: operationValues
    };
};

/**
 * Reset selected releases to original list
 *
 * @param {Object} data - the view model
 * @param {Object} searchState searchState
 * @param {Object} provider data provider
 * @returns {Object} return filter values from previous search
 */
export let initialize = function( data, searchState, provider ) {
    let tmpDbValue = [];
    if( searchState.clsFilters ) {
        if ( searchState.clsFilters.appliedFilters.dbValue.length > 0 ) {
            _.forEach( searchState.clsFilters.appliedFilters.dbValue, function( filter ) {
                tmpDbValue.push( {
                    operationType: _.clone( filter.operationType, true ),
                    operationValues: _.clone( filter.operationValues, true ),
                    operationTypeValues: data.operationTypeValues,
                    showAnd: tmpDbValue && tmpDbValue.length ? tmpDbValue.length > 0 : false,
                    count: tmpDbValue && tmpDbValue.length ? tmpDbValue.length : 0
                } );
            } );
            data.addFilterList.dbValue = tmpDbValue;
        }

        data.appliedFilterDetails = searchState.clsFilters.appliedFilters;
        provider.update( data.addFilterList.dbValue, data.addFilterList.dbValue.length );
        if ( searchState.clsFilters.releases.releasesString !== '' ) {
            data.releasesState = searchState.clsFilters.releases;
        }
    }
    return {
        appliedFilterDetails: data.appliedFilterDetails,
        addFilterList: data.addFilterList,
        releasesState: data.releasesState
    };
};

/**
 * Enables the apply filters button to be displayed.
 *
 * @param {Object} filterState - the filter state to apply filters with.
 */
export let displayApply = function( filterState ) {
    if( filterState.showApplyFilters && !filterState.value.showApplyFilters ) {
        var tmpContext = { ...filterState.value };
        tmpContext.showApplyFilters = true;
        filterState.update( tmpContext );
    }
};

/**
 * Disables the apply filters button to be displayed.
 *
 * @param {Object} filterState - the filter state to hide apply filters button with.
 */
export let hideApply = function( filterState ) {
    var tmpContext = { ...filterState.value };
    tmpContext.showApplyFilters = false;
    filterState.update( tmpContext );
};

/**
 * Enables the apply filters button to be displayed.
 *
 * @param {Object} filterState - the filter state to apply filters with.
 * @return {Object} - the updated filter state that will display the Apply Filters button.
 */
export let showHideApplyBtn = function( filterState, toApply ) {
    filterState.showApplyFilters = toApply;
    return filterState;
};

export default exports = {
    addFilter,
    addFilterListToParentView,
    createReleaseList,
    displayApply,
    getReleasesExpanded,
    getReleasePreferenceValues,
    hideApply,
    initialize,
    prepareList,
    removeFilter,
    resetReleases,
    revealFilterList,
    setFilters,
    showHideApplyBtn,
    updateSelectedReleases
};
