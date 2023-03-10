// Copyright (c) 2022 Siemens
import soaSvc from 'soa/kernel/soaService';
import saveInputWriterService from 'js/saveInputWriterService';
import epSaveService from 'js/epSaveService';
import mfeViewModelUtils from 'js/mfeViewModelUtils';
import eventBus from 'js/eventBus';
import { constants as epActivitiesConstants } from 'js/constants/epActivitiesConstants';
import _ from 'lodash';
import preferenceService from 'soa/preferenceService';

/**
 *
 * @param {Object} clickedElement clicked library Element
 * @param {*} inputObject panel input
 * @param {*} selectedObjects selection in table
 */
function handleLibraryClicked( clickedElement, inputObject, selectedObjects ) {
    let code = getCodeForSelectedObject( clickedElement );
    if( code ) {
        searchForLibraryActivity( code ).then( libraryActivities => instantiateActivity( libraryActivities.result[ 0 ], inputObject, selectedObjects ) );
    }
}

/**
 *
 * @param {*} clickedElement selectedObject
 * @return {String} code
 */
function getCodeForSelectedObject( clickedElement ) {
    if( !clickedElement.anchorNode ) {
        // not clicking an actual cell
        return null;
    }
    let attributes = clickedElement.anchorNode.parentElement.attributes;
    for( let key in attributes ) {
        let attr = attributes[ key ];
        if( attr.name === 'onclick' && attr.value.includes( 'MTMnavigate' ) ) {
            let codeString = attr.value;
            let attrValues = codeString.split( ',' );
            if( attrValues.length > 0 ) {
                return attrValues[ 1 ].replaceAll( ' ', '' ).replaceAll( '\'', '' );
            }
        }
    }
    return null;
}

/**
 *
 * @param {String} searchText searchText
 * @returns {Object} object
 */
function searchForLibraryActivity( searchText ) {
    return soaSvc.post( 'Internal-AWS2-2012-10-Finder', 'findObjectsByClassAndAttributes2', getSearchInput( searchText ) ).then( function( response ) {
        return response;
    } );
}

/**
 *
 * @param {String} searchText searchText
 * @returns {Object} search input
 */
function getSearchInput( searchText ) {
    return {
        input: {
            clientId: 'TC_MFG_ID',
            searchMode: 'GeneralQuery',
            attributes: [],
            startIndex: 0,
            maxLoad: 50,
            maxToReturn: 1,
            searchCriteria: [ {
                className: 'Ept0LibraryActivity',
                searchAttributes: {
                    time_system_code: searchText
                }
            } ],
            uids: []
        }
    };
}

/**
 * instantiateActivity
 * @param {*} libraryActivity the selected library activity
 * @param {*} inputObject panel input
 * @param {*} selectedObjects selection in table
 * @param {*} properties selection in table
 * @returns {Promise} save promise
 */
function instantiateActivity( libraryActivity, inputObject, selectedObjects, properties ) {
    const id = mfeViewModelUtils.generateUniqueId( 'new_object_id' );
    const instantiateInput = {
        id,
        connectTo: inputObject.uid,
        libraryObject: libraryActivity.uid
    };
    const modifyPropertiesInput = {};
    if( properties ) {
        modifyPropertiesInput[ epActivitiesConstants.AL_ACTIVITY_MFG_QUANTITY_PROP_NAME ] = properties.quantity.toString();
        modifyPropertiesInput[ epActivitiesConstants.AL_ACTIVITY_TIME_SYSTEM_CATEGORY_PROP_NAME ] = properties.category.toString();
        if( isStandardFrequencyMode() ) {
            modifyPropertiesInput[ epActivitiesConstants.AL_ACTIVITY_TIME_SYSTEM_FREQUENCY_PROP_NAME ] = properties.frequency.toString();
        } else {
            modifyPropertiesInput[ epActivitiesConstants.EPT_REPEAT_PROP_NAME ] = properties.frequencyNumerator.toString();
            modifyPropertiesInput[ epActivitiesConstants.EPT_PER_CYCLE_PROP_NAME ] = properties.frequencyDenominator.toString();
        }
    }
    const relatedObjects = [ libraryActivity, inputObject ];
    const predecessor = _.last( selectedObjects );
    if( predecessor ) {
        relatedObjects.push( predecessor );
        modifyPropertiesInput[ epActivitiesConstants.AL_ACTIVITY_PRED_LIST_PROP_NAME ] = predecessor.uid;
    }
    const saveWriter = saveInputWriterService.get();
    saveWriter.addInstantiateObject( instantiateInput, { al_activity_Mfg0quantity: '' } );
    if( !_.isEmpty( modifyPropertiesInput ) ) {
        _.forOwn( modifyPropertiesInput, function( value, key ) {
            saveWriter.addModifiedProperty( id, key, [ value ] );
        } );
    }
    return epSaveService.saveChanges( saveWriter, false, relatedObjects ).then( function( saveResponse ) {
        _.forEach( saveResponse.saveResults, result => {
            if( result.clientID === id ) {
                eventBus.publish( 'ep.activityCreated', { created: result.saveResultObject.uid } );
            }
        } );
    } );
}

/**
 *
 * @returns {boolean} true if preference value is standard otherwise false
 */
function isStandardFrequencyMode() {
    const values = preferenceService.getLoadedPrefs()[ epActivitiesConstants.EP_TIME_ACTIVITY_FREQUENCY_MODE ];
    return values && values.length > 0 && values[ 0 ] === 'STANDARD';
}

export default {
    handleLibraryClicked,
    instantiateActivity,
    isStandardFrequencyMode
};
