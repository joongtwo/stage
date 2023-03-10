// Copyright (c) 2022 Siemens

/**
 * This is a utility for admin services
 *
 * @module js/classifyAdminUtil
 */
import classifyAdminConstants from 'js/classifyAdminConstants';
import localeSvc from 'js/localeService';
import parsingUtils from 'js/parsingUtils';
import _ from 'lodash';

var exports = {};

var _currentLocale = localeSvc.getLanguageCode();

/**
 * Following method splits IRDI and provides individual values
 * @param {String} IRDI IRDI of object type
 * @return {ARRAY} IRDI tokens
 */
export let splitIRDI = function( IRDI ) {
    return IRDI.split( '#' );
};


/**
 * Creates cell for given table
 * @param {String} key Column name
 * @param {Object} value Field value for cell
 * @return {Object} temp2 Returns the cell object
 */
export let createCell = function( key, value ) {
    if( value === undefined || value === null ) {
        value = '';
    }
    var temp2 = {};
    temp2.name = key;
    temp2.type = 'STRING';
    temp2.value = value.toString();
    temp2.uiValue = value.toString();
    return temp2;
};
/**
 * @deprecated
 * Special case, method to check version of Team-center release till SOAs are in all releases
 * @param {Integer} majorVersion major version
 * @param {Integer} minorVersion minor version
 * @return {Boolean} true if supported, false otherwise
 * */
export let getSupportedSOA = function( majorVersion, minorVersion ) {
    var supportedRelease = majorVersion >= 13 && minorVersion >= 1;
    return {
        supported: supportedRelease,
        serviceName: classifyAdminConstants.SOA_NAME,
        operationName: classifyAdminConstants.OPERATION_NAME
    };
};

/**
 * Following method gets display value for property. It honors L10n translations
 * @param {*} valueObj Supplied Object to look up for
 * @returns {String} Display Value
 */
export let getValue = function( valueObj ) {
    var value = '';

    if( valueObj !== undefined ) {
        value = valueObj;
    }

    if(  valueObj && valueObj.hasOwnProperty( classifyAdminConstants.VALUE_KEY ) ) {
        value = valueObj.Value;

        //Translate
        var translations = valueObj.Translations;
        if ( translations && translations.length > 0 ) {
            let idx = _.findIndex( translations, function( trn ) {
                //find translation for current locale
                return trn.Locale.substring( 0, 2 ) === _currentLocale;
            } );

            if ( idx !== -1 ) {
                //check if translation is approved
                var translation = translations[idx];
                if ( translation.TranslationStatus === classifyAdminConstants.TRANSLATION_APPROVED ) {
                    value = translation.Value;
                }
            }
        }
    }
    return value;
};

/**
 * Gets Javascript sub object
 * @param {*} object  Passed input object
 * @param {*} key key to search for within the object
 * @returns {Object} key
 */
export let getObjectAsPerKey = function( object, key ) {
    return object[key];
};


/**
 * Following method parses the SOA response and fetches the objectDefinitions
 * @param {String} refJson  JSON response
 * @returns {Object} map of IRDI:Object entries
 */
export let parseJsonForObjectDefinitions = function( refJson ) {
    var objectDefinitions = parsingUtils.parseJsonString( refJson ).ObjectDefinitions;
    var displayNames = parsingUtils.parseJsonString( refJson ).DisplayNames;
    var objectDefinitionsDisplayNames = objectDefinitions;
    if( displayNames !== undefined && objectDefinitionsDisplayNames !== undefined ) {
        objectDefinitionsDisplayNames.displayNames = displayNames;
    }
    return objectDefinitionsDisplayNames;
};

/**
 * Following method parses the SOA response and fetches the parent details
 * @param {String} refJson  JSON response
 * @returns {Object} map of parent definitions
 */
export let parseJsonForParents = function( refJson ) {
    return parsingUtils.parseJsonString( refJson ).Parents;
};


/**
* Following method parses the SOA response and fetches the KeyLOV definition
 * @param {String} refJson  JSON response
 * @returns {Object} KeyLOV definition
 */
export let parseJsonForKeyLOV = function( refJson ) {
    return parsingUtils.parseJsonString( refJson ).KeyLOVDefinitions;
};


/**
 * Returns image file tickets
 * @param {String} refJson JSON string
 * @return {ARRAY} images
 */
export let getImageFileTickets = function( refJson ) {
    var allObjects = parsingUtils.parseJsonString( refJson ).Result;
    var hasImages = false;
    var puid;

    if( allObjects[ 0 ].SearchResults && allObjects[ 0 ].SearchResults.Objects && allObjects[ 0 ].SearchResults.Objects.length > 0 &&
        allObjects[ 0 ].SearchResults.Objects[0].ImageFileTickets ) {
        hasImages = true;
        var tmpUid = allObjects[ 0 ].SearchResults.Objects[0].puid;
        //puid currently returns 28chars. First 14 are uid
        puid = {
            selectionData:{
                value:{
                    selected : [ {
                        uid : tmpUid.substring( 0, 14 )
                    } ]
                }
            }
        };
    }

    return {
        hasImages: hasImages,
        puid:  puid
    };
};

/**
 * Following method changes display mode to Summary View layout
 * @param {*} refJson JSON string
 * @param {String} type object type
 * @param {Boolean} isSummary true of summary, false otherwise
 * @param {Boolean} isSearch true of summary, false otherwise
 * @returns {String} JSON string
 */
export let parseJson = function( refJson, type, isSummary, isSearch ) {
    var typeObjects = [];
    var allObjects =  parsingUtils.parseJsonString( refJson ).Result;
    if ( type === classifyAdminConstants.PROPERTIES ) {
        typeObjects = allObjects[ 0 ].SearchResults;
    } else if ( type === classifyAdminConstants.KEYLOV ) {
        typeObjects = isSummary ? allObjects[ 1 ].SearchResults : allObjects[ 0 ].SearchResults;
    } else if ( type === classifyAdminConstants.CLASSES ) {
        typeObjects = isSummary ? allObjects[ 2 ].SearchResults : allObjects[ 0 ].SearchResults;
    } else if ( type === classifyAdminConstants.NODES ) {
        typeObjects = isSummary ? allObjects[ 3 ].SearchResults : allObjects[ 0 ].SearchResults;
    } else if( type === 'Attributes' ) {
        //both class definition and property definition may exists
        typeObjects = allObjects[ 0 ].SearchResults;
        if( allObjects.length > 1 ) {
            var typeObjects2 = allObjects[ 1 ].SearchResults;

            var newObjects = typeObjects2.Objects.concat( typeObjects.Objects );
            var typeObjects3 = {
                ObjectType: 'Attribute',
                Objects: newObjects,
                totalFound: newObjects.length,
                totalLoaded: newObjects.length
            };
            typeObjects = typeObjects3;
        }
    } else if ( type === 'AttributesPanel' ) {
        //both class definition and property definition may exists
        //check length of allObjects
        if( allObjects.length > 0 ) {
            if( allObjects.length > 1 ) {
                typeObjects = allObjects[ 0 ].SearchResults;
                var typeObjects2 = allObjects[ 1 ].SearchResults;
                var newObjects = typeObjects2.Objects.concat( typeObjects.Objects );
                var typeObjects3 = {
                    ObjectType: 'AttributesPanel',
                    Objects: newObjects,
                    totalFound: newObjects.length,
                    totalLoaded: newObjects.length
                };

                typeObjects = typeObjects3;
            }else{
                typeObjects = allObjects[ 0 ].SearchResults;
            }
        }
    }
    return {
        objects: typeObjects.Objects,
        totalFound: typeObjects.totalFound,
        totalLoaded: typeObjects.totalLoaded,
        parents: isSearch ? typeObjects.Parents : undefined
    };
};


export default exports = {
    createCell,
    getImageFileTickets,
    getObjectAsPerKey,
    getSupportedSOA,
    getValue,
    parseJson,
    parseJsonForParents,
    parseJsonForKeyLOV,
    parseJsonForObjectDefinitions,
    splitIRDI
};
