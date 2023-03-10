// Copyright (c) 2022 Siemens

/**
 * This is a service file for release box component
 *
 * @module js/AwClsReleaseBoxService
 */
import classifyDefSvc from 'js/classifyDefinesService';
import _ from 'lodash';

var exports = {};

/**
  * This method is used to get the preference values for the CST_supported_eclass_releases preference.
  * @param {Boolean} isClsActive Boolean value denotes if presentation hierarchy is active
  * @param {Object} prefValues the preference values
  * @param {String} filter Applied filter criteria
  * @param {Object} releaseState previous releasesstate that's required to set in Release dropdown
  *  @param {Object} releasesLOV release lov view model property
  * @returns {Object} output preference values
  */
export let getReleases = function( isClsActive, prefValues, filter, releaseState, releasesLOV ) {
    var prefs = [];
    var tempDisplayValsModel = [];
    var tempDbvalues = [];
    var tempDisplayvalues = [];
    var tempUiValue = '';

    if( isClsActive && isClsActive.length > 0
          && isClsActive[0] === classifyDefSvc.LOGICAL_STR_TRUE ) {
        if ( prefValues && prefValues.length > 0 ) {
            for( var idx = 0, idx1 = 0; idx < prefValues.length - 1; idx++ ) {
                let prefValue = prefValues[ idx ];
                let prefDisplay = prefValues[ idx + 1 ];
                var validValue = !releasesLOV.valueUpdated;
                if ( releasesLOV.uiValue !== '' ) {
                    let valNdx = _.findIndex( releasesLOV.dbValue, function( val ) {
                        return val === prefValue;
                    } );
                    validValue = valNdx !== -1;
                }
                if( validValue ) {
                    prefs.push( { propDisplayValue: prefDisplay, propInternalValue: prefValue, selected: true, isChecked: true } );
                    tempDbvalues[idx1] = prefValue;
                    tempDisplayvalues[ idx1 ] = prefDisplay;
                    tempDisplayValsModel.push( { displayValue: prefDisplay, isInEditMode: false, selected: false } );
                    tempUiValue += prefDisplay + ', ';
                    idx1 += 1;
                } else {
                    prefs.push( { propDisplayValue: prefDisplay, propInternalValue: prefValue, selected: false, isChecked: false } );
                }
                idx += 1;
            }
        }
        if( filter ) {
            var prefsNew = [];
            for( var idx = 0; idx < prefs.length; idx++ ) {
                if( _.includes( prefs[ idx ][classifyDefSvc.PROPERTY_DISP_VAL].toLowerCase(), filter.toLowerCase() ) ) {
                    prefsNew.push( prefs[idx] );
                }
            }
            prefs = prefsNew;
        }
    }
    //remove ", " after the last selected release from tempUiValue
    tempUiValue = tempUiValue.slice( 0, -2 );

    releasesLOV.dbValue = tempDbvalues;
    releasesLOV.uiValue = tempUiValue;
    releasesLOV.displayValues = tempDisplayvalues;
    releasesLOV.displayValsModel = tempDisplayValsModel;

    return {
        releases: prefs,
        releasesLOV: releasesLOV
    };
};

/**
 * Initialized Release Box component with new values.
 * @param {Array} selectedObjects selected releases
 * @param {Arrayt} totalReleases number of releases
 * @return {Object} structure
 */
function isReleaseActive( selectedObjects, totalReleases ) {
    var delimit = '&&';
    var releasesString = '';
    var releasesActive = false;
    var displayReleases = false;
    var releases = 0;
    var structure = {};
    var releaseSet = [];
    structure.releasesString = '';
    structure.releasesActive = false;
    structure.displayReleases = false;
    structure.releases = 0;

    if ( !_.isEmpty( selectedObjects ) ) {
        releasesActive = true;
    }
    _.forEach( selectedObjects, function( release ) { // Loop on releases
        //if ( release.selected && release.selected === 'true' ) { // Check selected flag on full view
        releases++;
        releasesString += delimit;
        releasesString += release.propInternalValue;
        //}
    } );
    if ( selectedObjects.length !== 1 ) { // Do not display releases on items when only 1 release selected
        displayReleases = true;
    }

    if ( selectedObjects.length ===  totalReleases.length / 2 || releasesString === '' ) {
        releasesActive = false;
        displayReleases = false;
        releases = 0;
    }

    structure.releasesString = releasesString;
    structure.releasesActive = releasesActive;
    structure.displayReleases = displayReleases;
    structure.releases = releases;
    return structure;
}


/**
 * Initialized Release Box component with new values.
 * @param {Object} eventData User input
 * @param {Object} state state that needs to be passed on associated tree to update hierarchy
 * @param {Object} totalReleases the preference values
 */
export let initialize = function( eventData, state, totalReleases ) {
    const tmpState = { ...state.value };
    let structure = isReleaseActive( eventData.selectedObjects, totalReleases );
    tmpState.releasesString = structure.releasesString;
    tmpState.displayReleases = structure.displayReleases;
    tmpState.releasesStruct = eventData.selectedObjects;
    tmpState.releases = structure.releases;
    tmpState.releasesActive = structure.releasesActive;
    tmpState.allUnselected = structure.releasesString === '';
    state.update( tmpState );
};


export default exports = {
    getReleases,
    initialize
};
