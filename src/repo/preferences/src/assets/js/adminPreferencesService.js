/* eslint-disable max-lines */
// @<COPYRIGHT>@
// ===========================================================================
// Copyright 2018.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ===========================================================================
// @<COPYRIGHT>@

/* global
 define
 Map
 */

/**
 * A service that manages the preferences and its category.<br>
 * Note: This module does not return an API object. The API is only available when the service defined this module is
 * injected by AngularJS.
 *
 * @module js/adminPreferencesService
 */

import AwStateService from 'js/awStateService';
import adminPreferenceUserUtil from 'js/adminPreferenceUserUtil';
import searchCommonUtils from 'js/searchCommonUtils';
import appCtxSvc from 'js/appCtxService';
import soaService from 'soa/kernel/soaService';
import AwPromiseService from 'js/awPromiseService';
import localeService from 'js/localeService';
import cdm from 'soa/kernel/clientDataModel';
import tcSessionData from 'js/TcSessionData';
import editHandlerService from 'js/editHandlerService';
import commandPanelService from 'js/commandPanel.service';
import messagingService from 'js/messagingService';
import _ from 'lodash';
import assert from 'assert';
import eventBus from 'js/eventBus';
import filterPanelService from 'js/filterPanelService';
import searchFilterService from 'js/aw.searchFilter.service';
import awSearchSublocationService from 'js/awSearchSublocationService';


var exports = {};

var cachedNewPrefName = '';

var _localTextBundle = localeService.getLoadedText( 'preferenceMessages' );

// Array of Preference Protection Scopes
var _protectionScopes = [ 'User', 'Role', 'Group', 'Site', 'System' ];

/**
  * Map of preference objects
  *
  * Structure: {
  *    key: filterName,
  *    value: Map
  *         key: preference name
  *         value: [PreferenceLocationInstance]
  * }
  */
var _preferenceFilters = null;

/**
  * Array of PreferenceLocationInstance
  */
var _preferenceInstances = [];


/**
  * Converts preference type from string to integer.
  * @param  {Object} typeStr - preference type
  *
  * @returns {int} - int index for value type
  */
export let convertValueTypeToInt = function( typeStr ) {
    if( typeStr === 'String' ) {
        return 0;
    } else if( typeStr === 'Logical' ) {
        return 1;
    } else if( typeStr === 'Integer' ) {
        return 2;
    } else if( typeStr === 'Double' ) {
        return 3;
    } else if( typeStr === 'Date' ) {
        return 4;
    }
    assert( false, 'Invalid preference type encounter.' );
};


/**
  * Show usage message.
  */
var _showUsageMessage = function( searchString ) {
    var localTextBundle = localeService.getLoadedText( 'preferenceMessages' );
    var prefMsg = localTextBundle.prefFilterUsage;
    prefMsg = prefMsg.replace( '{0}', 'name' );
    prefMsg = prefMsg.replace( '{1}', 'name, values' );
    prefMsg = prefMsg.replace( '{2}', 'description' );

    var advancedSearchMsg = localTextBundle.advancedSearchMessage;
    advancedSearchMsg = advancedSearchMsg.replace( '{0}', prefMsg );

    var escapeCharsMsg = localTextBundle.prefEscapeChars;
    escapeCharsMsg = escapeCharsMsg.replace( '{0}', advancedSearchMsg );

    var msg = localTextBundle.usageMessage;
    msg = msg.replace( '{0}', searchString );
    msg = msg.replace( '{1}', escapeCharsMsg );

    messagingService.showInfo( msg );
};

/**
  * Returns the index for the selected preference in the table
  * NOTE: We may not need to do this after the selection issue is fixed, we could potentially use updateSelection from selectionService
  * @param {Object} selectedPreference - selected preference
  * @param {Object} matchedPreferences - array of matched preferences
  *
  * @returns {Number} the index of the selected preference in the array (the correct row in the table)
  */
var getIndexOfSelectedPref = function( newPref, matchedPreferences ) {
    for( var i = 0; i < matchedPreferences.length; i++ ) {
        var objHdrFtr = cdm.getObject( matchedPreferences[ i ].uid );
        if( newPref === objHdrFtr.props.prf1Name.dbValues[0] ) {
            return i;
        }
    }
    return -1;
};

var getIndexOfSelectedPrefNameAndLoc = function( selectedPrefName, selectedPrefLoc, matchedPreferences ) {
    for( var i = 0; i < matchedPreferences.length; i++ ) {
        var objHdrFtr = cdm.getObject( matchedPreferences[ i ].uid );
        if( selectedPrefName === objHdrFtr.props.prf1Name.dbValues[0]  && selectedPrefLoc === objHdrFtr.props.prf1Location.dbValues[0] ) {
            return i;
        }
    }
    return -1;
};


/**
  * Highlights the first row in the table, which corresponds to the newly created preference
  * @param {Object} newPref the information stored at ctx.tcadmconsole.searchCriteria.newPref, which
  *                         indicates that we should highlight the new pref in the table
  * @param {Object} vmData viewModel data
  * @param {Object} selectedPreference the currently selected preference
  *
  */
export let selectNewPrefRow = function( newPref, newPrefLoc, vmData, selectedPreference ) {
    const prefCntxt = appCtxSvc.getCtx( 'ctx.tcadmconsole.searchCriteria' );
    let newprefCntxt = { ...prefCntxt };

    var selectionModel = vmData.dataProviders.prefTableDataProvider.selectionModel;
    // if( !_.isUndefined( newPref ) && vmData.searchResults.objects.length > 0 ) {
    if( !_.isUndefined( newPref ) && _.isUndefined( newPrefLoc ) && vmData.searchResults.objects.length > 0 && newPref !== cachedNewPrefName ) {
        var index = getIndexOfSelectedPref( newPref, vmData.searchResults.objects );
        cachedNewPrefName = newPref;
        if( index > -1 ) {
            selectionModel.setSelection( vmData.searchResults.objects[ index ] );
        }
        //newprefCntxt.newPref = undefined;
        appCtxSvc.updateCtx( 'ctx.tcadmconsole.searchCriteria', newprefCntxt );
    } else if( !_.isUndefined( newPref ) && vmData.searchResults.objects.length > 0 && !_.isUndefined( newPrefLoc ) ) {
        cachedNewPrefName = newPref;
        var index = getIndexOfSelectedPrefNameAndLoc( newPref, newPrefLoc, vmData.searchResults.objects );
        if( index > -1 ) {
            selectionModel.setSelection( vmData.searchResults.objects[ index ] );
        } else if( index === -1 ) {
            newPrefLoc = newPrefLoc.substring( 0, newPrefLoc.indexOf( '(' ) - 1 );
            index = getIndexOfSelectedPrefNameAndLoc( newPref, newPrefLoc, vmData.searchResults.objects );
            selectionModel.setSelection( vmData.searchResults.objects[ index ] );
        }

        newprefCntxt.newPrefLoc = undefined;
        //newprefCntxt.newPref = undefined;
        appCtxSvc.updateCtx( 'ctx.tcadmconsole.searchCriteria', newprefCntxt );
    } else if( !_.isNull( selectedPreference ) && vmData.searchResults.objects.length > 0  ) {
        var selectedPreferenceLoc = selectedPreference.props.prf1Location.dbValue;
        var index = getIndexOfSelectedPrefNameAndLoc( selectedPreference.props.prf1Name.dbValue, selectedPreferenceLoc, vmData.searchResults.objects );
        if( index > -1 ) {
            selectionModel.setSelection( vmData.searchResults.objects[ index ] );
        }
        if( selectedPreferenceLoc === 'None' && index === -1 ) {
            // When None location preference is given some value.
            index = getIndexOfSelectedPrefNameAndLoc( selectedPreference.props.prf1Name.dbValue, 'Site', vmData.searchResults.objects );
            selectionModel.setSelection( vmData.searchResults.objects[ index ] );
        }
    }
};

/**
  * This method would filter the preference needed to show based on COTS, and protection scope
  * @param  {Array} prefInstances - array of preference instances
  *
  * @return {Array} matchedPreferences - array of preferences to show
  */
/* var getPreferencesToShow = function( prefInstances ) {
     var matchedPreferences = [];
     for( var i = 0; i < prefInstances.length; i++ ) {
         var location = prefInstances[ i ].locationInfo.location;
         var protectionScope = prefInstances[ i ].definition.protectionScope;
         if( location.prefLoc === 'COTS' || location.prefLoc === 'Overlay' ||
             location.prefLoc === 'Env' ||
             location.index >= exports.findSearchStartLocation( protectionScope ) ) {
             matchedPreferences.push( prefInstances[ i ] );
         }
     }
     return matchedPreferences;
 }; */

/**
  * @param {Object} uwDataProvider - An Object ( usually a UwDataProvider ) on the DeclViewModel on the $scope this action function is invoked from.
  * @param {number} columnInfo the array of objects containing the column configuration data
  *
  * @return {Promise} A Promise that will be resolved with the requested data when the data is available.
  *
  * <pre>
  * {
  *     columnInfos : {Array} An array containing the column information related to the row data created by this service.
  * }
  * </pre>
  */
export let loadTableColumns = function( uwDataProvider, columnInfo ) {
    var deferred = AwPromiseService.instance.defer();

    // This extra column is placeholder for icon.
    // AW client framework consider this to proper behavior of freeze\unfreeze of columns.
    var iconColumn = {
        name: 'icon1',
        displayName: '',
        width: 40,
        enableColumnMoving: false,
        enableColumnResizing: false,
        enableFiltering: false,
        enableSorting: false,
        enableColumnMenu: false
    };

    // Making 'icon1' column as first column
    columnInfo.unshift( iconColumn );

    uwDataProvider.columnConfig = {
        columns: columnInfo
    };

    deferred.resolve( {
        columnInfos: columnInfo
    } );
    return deferred.promise;
};


/**
  * Get display value for 'ProtectionScope' label.
  * @param {boolean} value key of Protection Scope messages
  *
  * @return {String} display value for Protection Scope field
  */
export let getDisplayValueForProtectionScope = function( value ) {
    return localeService.getLoadedText( 'preferenceMessages' )[ value ];
};

/**
  * If preference value is array of string, it should be displayed as comma separated
  * string inside preference table. This method will do this job.
  * @param {Object} values preference value
  * @param {boolean} isArray flag to determine whether preference is array or non-array
  *
  * @return {String} comma separated values if array type otherwise value txt
  */
export let getDisplayValues = function( values, isArray ) {
    if( isArray && !_.isUndefined( values ) && values !== '' ) {
        values = values.join( ', ' );
    }
    return values;
};


var generateParentsObject = function( orgObjects ) {
    // We ignore the first object which is site
    var parents = [ {} ];
    for( var i = 0; i < orgObjects.length; i++ ) {
        parents.push( {
            displayName: orgObjects[ i ].uiValues[ 0 ],
            object: {
                uid: orgObjects[ i ].dbValues[ 0 ]
            }
        } );
    }
    // Session Object type does not match the Type mentioned in the Group Member object.
    // This is needed to have consistent types for end user case too.
    parents[ 1 ].object.type = exports.getGroupType();
    parents[ 2 ].object.type = exports.getRoleType();
    parents[ 3 ].object.type = exports.getUserType();
    return parents;
};

/**
  *Return the Group UID
  *
  */
export let getGroupUID = function( parents ) {
    var parentsCtx = appCtxSvc.getCtx( 'parents' );
    let newparentsCtx = { ...parentsCtx };

    var isSystemAdmin = adminPreferenceUserUtil.isSystemAdmin();
    var isGroupAdmin = adminPreferenceUserUtil.isGroupAdmin();

    if( !isSystemAdmin && !isGroupAdmin ) {
        var session = cdm.getUserSession();
        if( session ) {
            // Access to any additional parents fields should require update of this method.
            newparentsCtx = generateParentsObject( [
                session.props.group,
                session.props.role,
                session.props.user
            ] );
        }
    }

    var parentsLength = Object.keys( newparentsCtx ).length;
    var orgObjectUID;
    for( var i = 1; i < parentsLength; i++ ) {
        var displayName = newparentsCtx[ i ].displayName;
        if( displayName === 'Group' ) {
            orgObjectUID = newparentsCtx[ i ].object.uid;
        }
    }

    return orgObjectUID;
};


/**
  * @param {Object} localizedProtectionScopes localized UI values for protection scopes
  *
  * @returns {Array} an array of protection scope view model objects for the create and edit listboxes
  */
export let getProtectionScopes = function( localizedProtectionScopes ) {
    // build protection scope list
    var protectionScopes = [];
    if ( localizedProtectionScopes ) {
        _protectionScopes.forEach( function( val ) {
            var protectionScopeVM = _getListObject( localizedProtectionScopes[ val ], val );
            protectionScopes.push( protectionScopeVM );
        } );
    }
    return protectionScopes;
};

/**
  * @returns {Array} an array of product Area view model objects for the create and edit listboxes
  */
export let getProductAreaList = function(  ) {
    // build protection scope list
    const prefCntxt = appCtxSvc.getCtx( 'tcadmconsole.preferences.filteredPreferenceInstances' );
    let newprefCntxt = [];
    newprefCntxt = { ...prefCntxt };

    var productAreasList = [];
    var parentsLength = Object.keys( newprefCntxt ).length;

    for( var i = 0; i < parentsLength; i++ ) {
        var categoryProp = _getListObject( newprefCntxt[i], newprefCntxt[i] );
        productAreasList.push( categoryProp );
    }
    return productAreasList;
};

/**
  * like the listbox service helper methods --- cloned from there.
  *
  * @param {String} uiVal display value
  * @param {String} dbVal internal value
  *
  * @return {Object} model object
  */
var _getListObject = function( uiVal, dbVal ) {
    return {
        propDisplayValue: uiVal,
        propInternalValue: dbVal,
        propDisplayDescription: '',
        hasChildren: false,
        children: {},
        sel: false
    };
};


/**
  * This method will return the Locations List
  * @param {String} type indicates if the user is importing or exporting
  * @returns {Array} array of localized locations
  */
export let getLocations = function( type ) {
    // Localization and build protection location list
    var locations = [];
    var val = _localTextBundle.User + ': ' + appCtxSvc.ctx.userSession.props.user_id.dbValues[ 0 ];
    locations.push( _getListObject( val, 'USER' ) );

    val = _localTextBundle.Role + ': ' + appCtxSvc.ctx.userSession.props.role_name.dbValues[ 0 ];
    locations.push( _getListObject( val, 'ROLE' ) );

    val = _localTextBundle.Group + ': ' + appCtxSvc.ctx.userSession.props.group_name.dbValues[ 0 ];
    locations.push( _getListObject( val, 'GROUP' ) );

    if( type === 'import' && adminPreferenceUserUtil.isSystemAdmin() ) {
        val = _localTextBundle.Site;
        locations.push( _getListObject( val, 'SITE' ) );
    } else if( type === 'export' ) {
        val = _localTextBundle.Site;
        locations.push( _getListObject( val, 'SITE' ) );
    }

    return locations;
};

/**
  * @returns {Array} an array of product area view model objects for the export preferences
  */
export let getProductAreaListToExport = function() {
    // Build product area list
    var prodAreas = exports.getProductAreaList();

    // Add 'All' option to product area list
    prodAreas = _.sortBy( prodAreas, 'propInternalValue' );
    prodAreas.unshift( _getListObject( _localTextBundle.all, 'all' ) );

    return prodAreas;
};

/**
  * Sets the supported versions for delete product area.
  */
export let setSupportedTCVersionForDeleteProductAreaContext = function() {
    var tcMajor = tcSessionData.getTCMajorVersion();
    var tcMinor = tcSessionData.getTCMinorVersion();
    var qrmNumber = tcSessionData.getTCQRMNumber();
    var isSupported = false;
    // If major version is greater than 12 .e.g TC13x onwards, then set true
    if( tcMajor > 12 ) {
        isSupported = true;
    } else if( tcMajor === 12 && tcMinor >= 1 ) { //For Tc12.1 and newer releases
        isSupported = true;
    } else if( tcMajor === 11 && tcMinor >= 2 && qrmNumber >= 7 ) { //For Tc11.6 and Internal name for Tc11.6 is 11.2.7
        isSupported = true;
    }
    appCtxSvc.registerPartialCtx( 'deleteProductArea.isSupportedVersion', isSupported );
};

/**
  * @param {String} location location
  * @param {String} orgName location org name
  *
  * @return{Object} formated display name
  */
export let generateLocationDisplayName = function( location, orgName ) {
    return _localTextBundle[ location ] + ' (' + orgName + ')';
};

/**
  * @return{String} group type.
  */
export let getGroupType = function() {
    return 'Group';
};

/**
  * @return{String} role type.
  */
export let getRoleType = function() {
    return 'Role';
};

/**
  * @return{String} User type.
  */
export let getUserType = function() {
    return 'User';
};


/**
  * Open filter panel
  *
  * @param {string} commandId panel id
  * @param {string} commandLocation location where panel will open
  * @param {object} context context to be passed to the panel
  */
export let openFilterPanel = function( commandId, commandLocation, context ) {
    var push = !adminPreferenceUserUtil.isSystemAdmin() && !adminPreferenceUserUtil.isGroupAdmin();
    commandPanelService.activateCommandPanel( commandId, commandLocation, context, push );
};

export const processOutput = ( data, dataCtxNode, searchData ) => {
    const newSearchData = { ...searchData.value };
    newSearchData.totalFound = data.totalFound;
    newSearchData.totalLoaded = data.totalLoaded;
    newSearchData.endIndex = data.endIndex;
    newSearchData.searchFilterMap = searchCommonUtils.processOutputFilterMap( newSearchData, data.formattedSearchFilterMap );
    newSearchData.searchFilterCategories = searchCommonUtils.processOutputSearchFilterCategories( newSearchData, data.filterCategories );
    newSearchData.objectsGroupedByProperty = { internalPropertyName: '' };
    delete newSearchData.chartProvider;
    newSearchData.bulkFiltersApplied = true;
    newSearchData.categories = filterPanelService.getCategories3( newSearchData, true );
    const appliedFiltersMap = awSearchSublocationService.getSelectedFiltersMap( newSearchData.categories );
    const appliedFiltersInfo = searchFilterService.buildSearchFiltersFromSearchState( appliedFiltersMap );
    newSearchData.appliedFilterMap = appliedFiltersInfo.activeFilterMap;
    const [ appliedFilters, categories ] = searchCommonUtils.constructAppliedFiltersAndCategoriesWhenEmptyCategoriesAndZeroResults( newSearchData, appliedFiltersInfo.activeFilters );

    newSearchData.appliedFilters = appliedFilters;
    searchData.update( newSearchData );
};

export const buildUrl = ( searchState ) => {
    if( searchState.filterString.length > 1 ) {
        AwStateService.instance.go( '.', { filter: searchState.filterString } );
    }
    if( searchState.filterString.length === 0 ) {
        AwStateService.instance.go( '.', { filter: '' } );
    }
};

/**
  * Initialization.
  */
const loadConfiguration = () => {
    eventBus.subscribe( '$locationChangeSuccess', ( { event, newUrl, oldUrl } ) => {
        // if we are navigating away from the preferences page, reset the service
        if( oldUrl.includes( 'showPreferences' ) && !newUrl.includes( 'showPreferences' ) ) {
            //exports.resetService();
            appCtxSvc.updatePartialCtx( 'tcadmconsole.searchCriteria', undefined );
            appCtxSvc.updatePartialCtx( 'tcadmconsole.preferences.useDefaultSort', true );
        }
    } );
};

loadConfiguration();

export default exports = {
    convertValueTypeToInt,
    selectNewPrefRow,
    loadTableColumns,
    getDisplayValueForProtectionScope,
    getDisplayValues,
    getProtectionScopes,
    getProductAreaList,
    getLocations,
    getProductAreaListToExport,
    setSupportedTCVersionForDeleteProductAreaContext,
    generateLocationDisplayName,
    getGroupType,
    getRoleType,
    getUserType,
    openFilterPanel,
    processOutput,
    getGroupUID,
    buildUrl
};

