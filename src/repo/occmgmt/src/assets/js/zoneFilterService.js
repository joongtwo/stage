// Copyright (c) 2022 Siemens

/**
 * @module js/zoneFilterService
 */
import uwPropertyService from 'js/uwPropertyService';
import occmgmtUtils from 'js/occmgmtUtils';
import _ from 'lodash';
import occmgmtSubsetUtils from 'js/occmgmtSubsetUtils';
import localeService from 'js/localeService';

var exports = {};

/*Due to framework limitation in dataParser and dataParseDefinition need to create the ViewModelProperties using JS code */

/**
 * Create ViewModelProperties object to render CheckBox on UI for each BoxZone/PlaneZone returned in perform search results
 *
 * @param  {Object} performSearchResponse performSearch SOA response
 * @param  {Object} selectedUids selected zone UIDs
 * @return {ViewModelProperties[]} List of ViewModelProperties to use for rendering of CheckBox
 */
export let createCheckBoxViewModelPropertiesForZones = function( performSearchResponse, selectedUids ) {
    var checkBoxPropertiesForZones = [];

    _.forEach( performSearchResponse.searchResults, function( zoneObj ) {
        if( zoneObj.props && zoneObj.props.object_string ) {
            var displayName = zoneObj.props.object_string.uiValues[ 0 ];
            var checkBoxProperty = uwPropertyService.createViewModelProperty( displayName, displayName, 'BOOLEAN', '', '' );
            checkBoxProperty.isEditable = true;
            checkBoxProperty.dbValue = false;
            checkBoxProperty.propertyLabelDisplay = 'PROPERTY_LABEL_AT_RIGHT';
            checkBoxProperty.propInternalVal = zoneObj.uid;
            if( selectedUids && selectedUids.includes( zoneObj.uid ) ) {
                uwPropertyService.setValue( checkBoxProperty, true );
            }
            checkBoxPropertiesForZones.push( checkBoxProperty );
        }
    } );

    return checkBoxPropertiesForZones;
};

/**
 * Function to get the list of selected BoxZone/PlaneZone uids from the list of CheckBox ViewModelProperties
 *
 * @param  {String[]} selectedZoneUIDs List of String object selected in box zone list
 * @param  {ViewModelProperties[]} selectedInputs List of ViewModelProperties object used for rendering Check-box on UI
 * @return {String[]} List of selected BoxZone/PlaneZone UIDs
 */
export let updateSelectedZoneList = function( selectedZoneUIDs, selectedInputs ) {
    var selectedInputUIDs = [];
    if( selectedZoneUIDs ) {
        selectedInputUIDs = selectedZoneUIDs;
    }
    _.forEach( selectedInputs, function( viewModelProperty ) {
        if( viewModelProperty.dbValue && !selectedInputUIDs.includes( viewModelProperty.propInternalVal ) ) {
            selectedInputUIDs.push( viewModelProperty.propInternalVal );
        }else if( !viewModelProperty.dbValue && selectedInputUIDs.includes( viewModelProperty.propInternalVal ) ) {
            selectedInputUIDs.splice( selectedInputUIDs.indexOf( viewModelProperty.propInternalVal ), 1 );
        }
    } );
    return selectedInputUIDs;
};

/**
 * Function to create the BoxZone/PlaneZone recipe and apply box/plane zone filter
 *
 * @param {String[]} selectedZoneUIds selected BoxZone UIDs to use for recipe creation
 * @param {String} searchOption Selected search option on UI to use for BoxZone recipe creation
 * @param {String}  zoneType    To determine if its a boxZone/planeZone
 * @param  {ViewModelProperties[]} loadedObjects List of ViewModelProperties object used for rendering Check-box on UI
 * @param {Object} sharedData shared data with discovery panel
 * @param {Object} activeViewSharedData shared data to update active view
 *
 */
export let applyZoneFilter = function( selectedZoneUIds, searchOption, zoneType, loadedObjects, sharedData, activeViewSharedData ) {
    var criteriaVal = [];
    var criteriaType;
    //Key indicating selected boxes information
    if( zoneType === 'BoxZone' ) {
        criteriaVal = [ 'Boxes' ];
        criteriaType = 'BoxZone';
    } else if( zoneType === 'PlaneZone' ) {
        criteriaVal = [ 'Planes' ];
        criteriaType = 'PlaneZone';
    }
    criteriaVal = criteriaVal.concat( selectedZoneUIds );
    criteriaVal.push( searchOption.dbValue );

    var displayString = createTransientZoneDisplayString( selectedZoneUIds, searchOption, loadedObjects );

    var recipeOperator = 'Filter';
    if( sharedData && sharedData.recipeOperator ) {
        recipeOperator = sharedData.recipeOperator;
    }
    //create BoxZone/PlaneZone criteria
    var zoneCriteria = {
        criteriaType: criteriaType,
        criteriaOperatorType: recipeOperator,
        criteriaDisplayValue: displayString,
        criteriaValues: criteriaVal,
        subCriteria: []
    };

    occmgmtSubsetUtils.updateSharedDataWithRecipeBeforeNavigate( activeViewSharedData, sharedData, zoneCriteria, -1, 'Awb0DiscoveryFilterCommandSubPanel' );
};

var createTransientZoneDisplayString = function( selectedZoneUids, searchOption, loadedObjects ) {
    var zoneDisplayString = '';
    var searchOptionDisplayValue = searchOption.uiValue;
    // For  selected Vmos, get the display name
    var selectedVmDisplayNames = getSelectedZoneListNames( loadedObjects );

    // Prepare display string for BoxZone / PlaneZone recipe
    // "Inside Only" of Box1, Box2, Box3, or Box4             --> if more then 2 Boxes
    // "Inside Only" of Box1 or Box2                          --> if 2 Boxes
    // "Inside Only" of Box1                                  --> if 1 Box

    // Add double quotes to search option if not present
    if( !searchOptionDisplayValue.match( '"' ) ) {
        searchOptionDisplayValue = '"' + searchOptionDisplayValue + '"';
    }

    var resource = localeService.getLoadedText( 'OccurrenceManagementSubsetConstants' );
    zoneDisplayString = resource.zoneDisplayString
        .format( searchOptionDisplayValue, selectedVmDisplayNames );
    return zoneDisplayString;
};

/**
 * Function to get the list of selected BoxZone/PlaneZone names from the list of CheckBox ViewModelProperties
 *
 * @param  {ViewModelProperties[]} loadedObjects List of ViewModelProperties object used for rendering Check-box on UI
 * @return {String[]} List of selected BoxZone/PlaneZone names
 */
var getSelectedZoneListNames = function( loadedObjects ) {
    var selectedInputNames = [];
    var formattedDisplayNames = '';

    var resource = localeService.getLoadedText( 'OccurrenceManagementSubsetConstants' );

    if( loadedObjects !== null && loadedObjects.length > 0 ) {
        _.forEach( loadedObjects, function( vmo ) {
            if( vmo.dbValue ) {
                selectedInputNames.push( vmo.propertyDisplayName );
            }
        } );
        // Prepare formatted string for BoxZone / PlaneZone recipe
        // Box1, Box2, Box3, or Box4             --> if more then 2 Boxes
        // Box1 or Box2                          --> if 2 Boxes
        // Box1                                  --> if 1 Box
        if( selectedInputNames.length === 1 ) {
            formattedDisplayNames = selectedInputNames[0];
        } else if( selectedInputNames.length === 2 ) {
            formattedDisplayNames = resource.zoneSelectedInputString.format( selectedInputNames[0], selectedInputNames[1] );
        } else {
            for( var inx = 0; inx < selectedInputNames.length; inx++ ) {
                if ( inx === selectedInputNames.length - 1 ) {
                    formattedDisplayNames = formattedDisplayNames.replace( /\s+$/, '' );
                    formattedDisplayNames = resource.zoneSelectedInputString.format( formattedDisplayNames, selectedInputNames[inx] );
                } else {
                    formattedDisplayNames = formattedDisplayNames + selectedInputNames[inx] + ', ';
                }
            }
        }
    }
    return formattedDisplayNames;
};


/**
 * Dummy action to full the compiler. This is needed to simply do the assignment in the ViewModel
 */
export let dummyAction = function( totalFound ) {
    return totalFound;
};

/**
 * Get the correct provider name based on tc version.
 *
 * @param {Object} providerName - The input 'provider name'
 * @returns {Object} The 'provider name' based on tc version
 */
export let getProviderName = function( providerName ) {
    var prefix = occmgmtUtils.isMinimumTCVersion( 14, 0 ) ? 'Fnd0' : 'Awb0';
    return prefix + providerName;
};

/**
 * Get the selected zone count.
 *
 * @param {Object} response - SOA response
 * @param {Object} selectedZoneUids - The selected box zone UIDs
 * @returns {Object} The selected zone count
 */
export let getSelectedZoneCount = function( response, selectedZoneUids ) {
    var selectedZoneCount = 0;
    if( response && selectedZoneUids ) {
        selectedZoneCount = selectedZoneUids.length;
    }
    return selectedZoneCount;
};


export default exports = {
    createCheckBoxViewModelPropertiesForZones,
    updateSelectedZoneList,
    applyZoneFilter,
    dummyAction,
    getProviderName,
    getSelectedZoneCount
};
