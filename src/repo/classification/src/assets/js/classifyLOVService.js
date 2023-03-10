// Copyright (c) 2022 Siemens

/**
 * This is a utility to format the classification LOVs to be compatible with the AW LOV widgets
 *
 * @module js/classifyLOVService
 */
import _ from 'lodash';
import AwPromiseService from 'js/awPromiseService';
import { getAttributeIntegerFromString } from 'js/classifyUtils';
import soaService from 'soa/kernel/soaService';
import uwPropertyService from 'js/uwPropertyService';

var exports = {};

// Global map for viewProps for interdependent keyLOV attributes
var viewPropMap = {};

// Global 'const' variable definitions (Javascript doesn't support const keyword everywhere yet)
var KL_HASH_STR = '#';
var KL_SUBMENU_START = '#>';
var KL_SUBMENU_END = '#<';

/**
 * Creates a new classification LOV api given an attribute ID
 *
 * @param {String} classId - The selected class ID
 * @param {String} attributeId - the attribute ID to get the LOV API for.
 * @param {Object} keyLOVDefinition - The KeyLOV definition object
 * @param {Boolean} isInterDependentKeyLOV - true if the keyLOV attribute is an interdependent KeyLOV
 * @param {Object} dependentAttributeIds - the list of dependent attribute IDs
 * @param {Object} viewProp the current viewProp object
 * @returns {Object} the LOVApi object
 */
function ClsLovApi( data, classID, attributeID, keyLOVDefinition, isInterDependentKeyLOV, dependentAttributeIds,
    viewProp, attrDepAttribute ) {
    if ( !classID || classID.length < 1 ) {
        throw 'Invalid Class ID.';
    }
    if ( !attributeID || attributeID.length < 1 ) {
        throw 'Invalid attribute ID.';
    }
    if ( !keyLOVDefinition ) {
        throw 'Invalid keyLOV info.';
    }

    this.classID = classID;
    this.attrID = attributeID;
    this.type = 'static';
    this.klEntries = [];
    this.keyLOVDefinition = keyLOVDefinition;
    this.isInterDependentKeyLOV = isInterDependentKeyLOV;
    this.dependentAttributeIds = dependentAttributeIds;
    this.attrDepAttribute = attrDepAttribute;

    //below assignment is necessary to make call to SOA
    if ( dependentAttributeIds !== undefined ) {
        this.dependentAttributeIdsLength = dependentAttributeIds.length;
    }

    if ( keyLOVDefinition && keyLOVDefinition.keyLOVEntries ) {
        var lovSvc = this;

        if ( isInterDependentKeyLOV ) {
            var klEntries = keyLOVDefinition.keyLOVEntries;
            lovSvc.klEntries = exports.buildingKeyLOVEntries( klEntries, keyLOVDefinition );
        } else {
            var recursionHelperIndexObject = {
                newIndex: 0
            };

            lovSvc.klEntries = exports.processKeyLOVEntriesForLOVApi( keyLOVDefinition, 0,
                recursionHelperIndexObject );
        }
    }

    if ( viewProp ) {
        viewPropMap[attributeID] = viewProp;
    }

    if ( viewProp && viewProp.dbValue !== null && viewProp.dbValue[0] ) {
        var depAttrValues = [];
        _.forEach( this.dependentAttributeIds, function( entry ) {
            if ( entry ) {
                var viewPropForDepAttribute = viewPropMap[entry];
                if ( viewPropForDepAttribute ) {
                    var selValue = '';
                    if ( viewPropForDepAttribute.dbValue && viewPropForDepAttribute.dbValue.length > 0 ) {
                        selValue = viewPropForDepAttribute.dbValue;
                    }

                    if ( _.isArray( viewPropForDepAttribute.dbValue ) ) {
                        selValue = viewPropForDepAttribute.dbValue[0];
                    } else {
                        selValue = viewPropForDepAttribute.dbValue;
                    }
                    depAttrValues.push( new DepAttrValues(
                        getAttributeIntegerFromString( viewPropForDepAttribute.attributeId ), selValue ) );
                }
            }
        } );


        data.dAttributeStruct.push( {
            classID: lovSvc.classID,
            selectedAttributeID: lovSvc.attrID,
            selectedValue: viewProp.dbValue[0],
            attributeValues: depAttrValues
        } );
    }
}


export let getKeyLOVsForDependentAttributes = function( depAttrStruct ) {
    soaService.post( 'Classification-2015-03-Classification', 'getKeyLOVsForDependentAttributes', {
        dependencyAttributeStruct: depAttrStruct
    } ).then( function( response ) {
        exports.getResponse( response );
    } ); // End of SOA service call
};

/**
 * Validates if the input is a valid KeyLOV Submenu start indicator
 *
 * @param {String} keyString - the input key.
 * @returns {bool} true if input string is "#>", false otherwise
 */
export let isSubmenuStart = function( keyString ) {
    if ( keyString === KL_SUBMENU_START ) {
        return true;
    }
    return false;
};

/**
 * Validates if the input is a valid KeyLOV Submenu end indicator
 *
 * @param {String} keyString - the input key.
 * @returns {bool} true if input string is "#<", false otherwise
 */
export let isSubmenuEnd = function( keyString ) {
    if ( keyString === KL_SUBMENU_END ) {
        return true;
    }
    return false;
};

/**
 * Validates if the input is a valid KeyLOV Submenu start indicator
 *
 * @param {Object} keyLOVDefinition - the keyLOVDefinition object.
 * @param {Integer} indexOfKLEntryToBeProcessed - the index of the KeyLOV entry to be processed from the
 *            keyLOVEntries array
 * @param {Object} recursionHelperIndexObject - the output object containing next index of the KeyLOV entry to
 *            be processed from the keyLOVEntries array when the recursively called function returns back to the
 *            original call.
 * @returns {ObjectArray} the array of processed KeyLOV entry Objects which could directly be used by ClsLOVApi;
 */
export let processKeyLOVEntriesForLOVApi = function( keyLOVDefinition, indexOfKLEntryToBeProcessed,
    recursionHelperIndexObject ) {
    var subMenuObjects = [];

    if ( keyLOVDefinition && keyLOVDefinition.keyLOVEntries ) {
        var localIndex = 0;
        for ( ; localIndex < keyLOVDefinition.keyLOVEntries.length; localIndex++ ) {
            if ( indexOfKLEntryToBeProcessed > localIndex ) {
                continue;
            }
            var keyLOVEntry = keyLOVDefinition.keyLOVEntries[localIndex];
            var subStr = keyLOVEntry.keyLOVkey.substring( 0, 2 );
            if ( exports.isSubmenuStart( subStr ) ) {
                var subMenuObject = {};
                // For Submenus, do not display the key, just the value
                subMenuObject.propDisplayValue = keyLOVEntry.keyLOVValue;
                subMenuObject.propInternalValue = keyLOVEntry.keyLOVkey;
                subMenuObject.parentRef = keyLOVEntry.keyLOVkey.substring( 2, keyLOVEntry.keyLOVkey.length );
                subMenuObject.propDisplayDescription = '';
                subMenuObject.sel = false;
                subMenuObject.hasChildren = true;

                // increment the indexOfKLEntryToBeProcessed
                indexOfKLEntryToBeProcessed = localIndex + 1;
                // Get the children by recursing
                subMenuObject.children = exports.processKeyLOVEntriesForLOVApi( keyLOVDefinition,
                    indexOfKLEntryToBeProcessed, recursionHelperIndexObject );

                indexOfKLEntryToBeProcessed = recursionHelperIndexObject.newIndex;

                // Add the SubMenus as children
                subMenuObjects.push( subMenuObject );
            } else if ( exports.isSubmenuEnd( subStr ) ) {
                indexOfKLEntryToBeProcessed = localIndex + 1;
                break;
            } else {
                // Regular entry
                var subMenuRegObject = {};
                subMenuRegObject.propDisplayValue = keyLOVDefinition.keyLOVOptions === 1 ? keyLOVEntry.keyLOVValue :
                    keyLOVEntry.keyLOVkey + ' ' + keyLOVEntry.keyLOVValue;
                subMenuRegObject.propInternalValue = keyLOVEntry.keyLOVkey;
                subMenuRegObject.propDisplayDescription = '';
                subMenuRegObject.hasChildren = false;
                subMenuRegObject.children = {};
                subMenuRegObject.sel = false;
                subMenuObjects.push( subMenuRegObject );
            }
        }
        recursionHelperIndexObject.newIndex = localIndex + 1;
    }
    return subMenuObjects;
};

/**
 * Validates if the input is a valid KeyLOV Submenu start indicator
 *
 * @param {Object} keyLOVDefinition - the keyLOVDefinition object.
 * @param {Integer} indexOfKLEntryToBeProcessed - the index of the KeyLOV entry to be processed from the
 *            keyLOVEntries array
 * @param {Object} recursionHelperIndexObject - the output object containing next index of the KeyLOV entry to
 *            be processed from the keyLOVEntries array when the recursively called function returns back to the
 *            original call.
 * @param {Object} list list
 * @returns {ObjectArray} the array of processed KeyLOV entry Objects which could directly be used by ClsLOVApi;
 */
export let processKeyLOVEntriesForLOVApiForView = function( keyLOVDefinition, indexOfKLEntryToBeProcessed,
    recursionHelperIndexObject, list ) {
    var subMenuObjects = [];

    if ( keyLOVDefinition && keyLOVDefinition.keyLOVEntries ) {
        var localIndex = 0;

        for ( ; localIndex < keyLOVDefinition.keyLOVEntries.length; localIndex++ ) {
            if ( indexOfKLEntryToBeProcessed > localIndex ) {
                continue;
            }
            var subMenuObject = {};
            subMenuObject.children = [];

            var keyLOVEntry = keyLOVDefinition.keyLOVEntries[localIndex];
            var subStr = keyLOVEntry.keyLOVkey.substring( 0, 2 );

            subMenuObject.keyLOVValue = keyLOVEntry.keyLOVValue;
            subMenuObject.keyLOVkey = keyLOVEntry.keyLOVkey;
            subMenuObject.isDeprecated = keyLOVEntry.isDeprecated;
            subMenuObject.propDisplayDescription = '';
            subMenuObject.sel = false;
            subMenuObject.hasChildren = true;

            if ( exports.isSubmenuStart( subStr ) ) {
                var listEntry = {};
                // For Submenus, do not display the key, just the value

                listEntry.keyLOVValue = keyLOVEntry.keyLOVValue;
                listEntry.keyLOVkey = keyLOVEntry.keyLOVkey;

                listEntry.propDisplayDescription = '';
                listEntry.isDeprecated = keyLOVEntry.isDeprecated;
                listEntry.sel = false;
                listEntry.hasChildren = false;

                // For Submenus, do not display the key, just the value
                // increment the indexOfKLEntryToBeProcessed
                indexOfKLEntryToBeProcessed = localIndex + 1;
                // Get the children by recursing

                subMenuObject.children.push( listEntry );
                subMenuObject.children.concat( exports.processKeyLOVEntriesForLOVApiForView( keyLOVDefinition,
                    indexOfKLEntryToBeProcessed, recursionHelperIndexObject, subMenuObject ) );

                indexOfKLEntryToBeProcessed = recursionHelperIndexObject.newIndex;

                // Add the SubMenus as children
                subMenuObjects.push( subMenuObject );
            } else if ( exports.isSubmenuEnd( subStr ) ) {
                var listEntry = {};
                // For Submenus, do not display the key, just the value

                listEntry.keyLOVValue = keyLOVEntry.keyLOVValue;
                listEntry.keyLOVkey = keyLOVEntry.keyLOVkey;

                listEntry.propDisplayDescription = '';
                listEntry.isDeprecated = keyLOVEntry.isDeprecated;
                listEntry.sel = false;
                listEntry.hasChildren = false;


                list.children.push( listEntry );
                indexOfKLEntryToBeProcessed = localIndex + 1;
                break;
            } else {
                // Regular entry
                var subMenuRegObject = {};
                subMenuRegObject.keyLOVValue = keyLOVDefinition.keyLOVOptions === 1 ? keyLOVEntry.keyLOVValue :
                    keyLOVEntry.keyLOVkey + ' ' + keyLOVEntry.keyLOVValue;
                subMenuRegObject.keyLOVkey = keyLOVEntry.keyLOVkey;
                subMenuRegObject.propDisplayDescription = '';
                subMenuRegObject.hasChildren = false;
                subMenuRegObject.children = {};
                subMenuRegObject.sel = false;
                list.children.push( subMenuRegObject );
            }
        }
        recursionHelperIndexObject.newIndex = localIndex + 1;
    }
    return subMenuObjects;
};


export let getBucket = function( subMenus, valueKey, dependentValueKey ) {
    var bucket = [];
    var entryBeingProcessed = null;

    for ( var idx = 0; idx < subMenus.length; idx++ ) {
        entryBeingProcessed = subMenus[idx];


        if ( bucket.length > 0 ) {
            break;
        } else {
            if ( entryBeingProcessed.hasChildren ) {
                bucket = getBucket( entryBeingProcessed.children, valueKey );
            } else if ( valueKey === '' ) {
                bucket = subMenus;
                break;
            } else if ( entryBeingProcessed.keyLOVkey === valueKey ) {
                bucket = subMenus;
                break;
            }
        }
    }
    return bucket;
};

/**
 * Gets the initial values for the LOV
 *
 * @param {String} filterStr - the filter string
 * @param {Object} deferred - the deferred to be resolved with the entries.
 * @param {String} name - the name
 * @returns {Object} promise
 */
ClsLovApi.prototype.getInitialValues = function( filterStr, deferred, name ) {
    return deferred.resolve( this.klEntries );
};

/**
 * Gets the initial values for the LOV After Clear All
 *
 * @param {String} filterStr - the filter string
 * @param {Object} deferred - the deferred to be resolved with the entries.
 * @param {String} name - the name
 * @returns {Object} promise
 */
ClsLovApi.prototype.getInitialValuesAfterClearAll = function( filterStr, deferred, name ) {
    var buildLOV = this;
    var keyLOVDefinition = this.keyLOVDefinition;
    var klEntries = this.keyLOVDefinition.keyLOVEntries;
    buildLOV.klEntries = [];
    var recursionHelperIndexObject = {
        newIndex: 0
    };
    buildLOV.klEntries = exports.buildingKeyLOVEntries( klEntries, keyLOVDefinition );
    buildLOV.klEntries = exports.processKeyLOVEntriesForLOVApi( keyLOVDefinition, 0,
        recursionHelperIndexObject );
    return deferred.resolve( buildLOV );
};

export let buildingKeyLOVEntries = function( klEntries, keyLOVDefinition ) {
    var keyEntries = klEntries;
    var buildLOV = [];

    _.forEach( keyEntries, function( entry ) {
        buildLOV.push( {
            propDisplayValue: keyLOVDefinition.keyLOVOptions === 1 ? entry.keyLOVValue : entry.keyLOVkey + ' ' + entry.keyLOVValue,
            propInternalValue: entry.keyLOVkey,
            propDisplayDescription: '',
            hasChildren: false,
            children: {},
            sel: false
        } );
    } );

    return buildLOV;
};

/**
 * Gets the initial values for the LOV
 *
 * @param {String} filterStr - the filter string
 * @param {Object} deferred - the deferred to be resolved with the entries.
 * @param {String} name - the name
 * @returns {Object} promise
 */
ClsLovApi.prototype.getInitialValuesLOV = function( filterStr, deferred, name ) {
    return deferred.resolve( this.keyLOVDefinition.klEntries.keyLOVEntries );
};

/**
 * gets the next values for the LOV. The classification SOAs do not support paging currently, so resolve the
 * promise to null.
 *
 * @param {Object} promise - to be resolved with the next value of the LOV
 */
ClsLovApi.prototype.getNextValues = function( promise ) {
    //Classification LOVs do not support paging.
    promise.resolve( null );
};

/**
 * Helper function
 *
 * @param {String} attrID the Attribute ID
 * @param {String} selectedValue the selected value
 */
function DepAttrValues( attrID, selectedValue ) {
    this.attributeID = attrID;
    this.value = selectedValue;
}

/**
 * Validates the LOV selection. Because this is a static LOV, there is no validation.
 *
 * @param {Object} data data
 * @param {Object} attr attribute
 * @param {Object} classifyState classify state
 * @param {Object} selected selected
 * @returns List of updated values
 */
export let validateLOVValueSelections = function( data, attr, classifyState, selected ) {
    var attrId = getAttributeIntegerFromString( attr.name );
    attr.fielddata.uiValue = selected[0].propDisplayValue;

    // Set the currently selected value
    uwPropertyService.setValue( viewPropMap[attrId], selected[0].propInternalValue );
    // Prior to making the SOA call, we need to get the Dependent attributes' selected Keys to pass to the SOA.
    var depAttrValues = [];
    _.forEach( attr.fielddata.lovApi.dependentAttributeIds, function( entry ) {
        if ( entry ) {
            var viewPropForDepAttribute = viewPropMap[entry];
            if ( viewPropForDepAttribute ) {
                var selValue = '';
                if ( viewPropForDepAttribute.dbValue && viewPropForDepAttribute.dbValue.length > 0 ) {
                    if ( _.isArray( viewPropForDepAttribute.dbValue ) ) {
                        selValue = viewPropForDepAttribute.dbValue[0];
                    } else {
                        selValue = viewPropForDepAttribute.dbValue;
                    }
                }
                //We currently need to transform these IDs into an int, this will need to be changed in future
                depAttrValues.push( new DepAttrValues(
                    getAttributeIntegerFromString( viewPropForDepAttribute.attributeId ), selValue ) );
            }
        }
    } );

    // Call getKeyLOVsForDependentAttributes to get the dependent attributes' info, so that the UI could be updated accordingly
    return soaService.post( 'Classification-2015-03-Classification', 'getKeyLOVsForDependentAttributes', {
        dependencyAttributeStruct: [ {
            classID: attr.fielddata.lovApi.classID,
            selectedAttributeID: attr.fielddata.lovApi.attrID,
            selectedValue: selected[0].propInternalValue,
            attributeValues: depAttrValues
        } ]

    } ).then( function( response ) {
        exports.getResponseForInitialization( response, data, attr, classifyState, selected );
        return {
            valid: true
        };
    } ); // End of SOA service call

    return false;
};

let getLovValues = function( data, attr ) {
    let attrLOV = [];
    _.forEach( attr.fielddata.lovApi.klEntries, function( entry ) {
        attrLOV.push( {
            propDisplayValue: entry.propDisplayValue,
            propInternalValue: entry.propInternalValue,
            attrId: attr.attrID,
            selected: false
        } );
    } );
    data.attrLOVList = attrLOV;
    data.lovInitialized = true;
    return attrLOV;
};

let filterLovValues = function( data, attr, filterString ) {
    let attrLOV = getLovValues( data, attr );
    let newAttrLOV = [];
    if ( filterString !== '' ) {
        _.forEach( attrLOV, function( attr ) {
            if ( _.includes( attr.propDisplayValue.toLowerCase(), filterString.toLowerCase() ) ) {
                newAttrLOV.push( attr );
            }
        } );
        return newAttrLOV;
    }
    return attrLOV;
};

/**
 * Load LOV values from lovAPI
 * @param {*} data view model
 * @param {*} attr LOV attribute to be initialized
 */
export const initLOVDataProvider = ( data, attr, instIndex ) => {
    exports.clearLovValue( data, attr );
    data.attrLovLink.valueUpdated = false;
    var lovdata = attr.fielddata.lovApi.klEntries;
    return processKeyLOVData( lovdata, instIndex, attr );
};


let processKeyLOVData = function( lovData, instIndex, attr ) {
    var attrLOV = [];

    if ( lovData ) {
        _.forEach( lovData, function( entry ) {
            let lov = {};
            lov.propDisplayValue = entry.propDisplayValue;
            lov.propInternalValue = entry.propInternalValue;
            lov.attrId = attr.name;
            lov.attrLabel = attr.label;
            lov.attrIndex = instIndex;
            lov.hasChildren = entry.hasChildren;
            lov.childRows = entry.children;
            if ( lov.hasChildren ) {
                var lovEntries = processKeyLOVData( entry.children, instIndex, attr );
                lov.getChildren = function getChildren() {
                    return lovEntries;
                };
            }
            attrLOV.push( lov );
        } );
    }
    return attrLOV;
};


/**
 * Validates the LOV selection. Because this is a static LOV, there is no validation.
 * @param {Object} data
 * @param {Object} attr
 * @param {Object} classifyState
 * @returns List of updated values
 */
export let initializeInterdepLOV = function( data, attr, classifyState ) {
    var lovSvc = this;
    const tmpState = { ...classifyState.value };

    let deferred = AwPromiseService.instance.defer();
    let attrLOV = [];

    //Handle filtering
    var provider = data.dataProviders.attrLOV;
    let entry = provider.getLovEntryRef();
    if ( entry && entry.current && entry.current.lovEntry.filterString !== '' &&
        entry.current.lovEntry.filterString !== null && entry.current.lovEntry.filterString !== undefined ) {
        attrLOV = filterLovValues( data, attr, entry.current.lovEntry.filterString );
        return {
            attrLOVList: attrLOV
        };
    }
    // Prior to making the SOA call, we need to get the Dependent attributes' selected Keys to pass to the SOA.
    var depAttr = attr.fielddata.lovApi.attrDepAttribute;
    //if no dbvalue selected, just return OOTB list
    if ( attr.fielddata.uiValue === '' ) {
        let hasValue = false;
        //check if any of dependent attributes have value. say Country. Cities should be specific to that country.
        _.forEach( attr.fielddata.lovApi.dependentAttributeIds, function( attrDep ) {
            if ( viewPropMap[attrDep].dbValue !== '' ) {
                hasValue = true;
            }
        } );
        if ( depAttr === '' || depAttr !== '' && hasValue ) {
            attrLOV = initLOVDataProvider( data, attr );
        } else {
            var keyLOVDefn = attr.fielddata.lovApi.keyLOVDefinition;
            attrLOV = buildingKeyLOVEntries( keyLOVDefn.keyLOVEntries, keyLOVDefn );
        }
        return {
            attrLOVList: attrLOV
        };
    }

    // Prior to making the SOA call, we need to get the Dependent attributes' selected Keys to pass to the SOA.
    var depAttrValues = [];
    _.forEach( attr.fielddata.lovApi.dependentAttributeIds, function( entry ) {
        if ( entry ) {
            var viewPropForDepAttribute = viewPropMap[entry];
            if ( viewPropForDepAttribute ) {
                var selValue = '';
                if ( viewPropForDepAttribute.dbValue && viewPropForDepAttribute.dbValue.length > 0 ) {
                    if ( _.isArray( viewPropForDepAttribute.dbValue ) ) {
                        selValue = viewPropForDepAttribute.dbValue[0];
                    } else {
                        selValue = viewPropForDepAttribute.dbValue;
                    }
                }
                //We currently need to transform these IDs into an int, this will need to be changed in future
                depAttrValues.push( new DepAttrValues(
                    getAttributeIntegerFromString( viewPropForDepAttribute.attributeId ), selValue ) );
            }
        }
    } );

    //Let's create a method for each attribute
    if ( attr.fielddata.lovApi.attrDepAttribute && attr.fielddata.lovApi.attrDepAttribute !== '' ) {
        var dependencyAttributeStruct = exports.getDependencyAttributeStruct( data, attr, classifyState );

        // Call getKeyLOVsForDependentAttributes to get the dependent attributes' info, so that the UI could be updated accordingly
        soaService.post( 'Classification-2015-03-Classification', 'getKeyLOVsForDependentAttributes', {
            dependencyAttributeStruct: dependencyAttributeStruct

        } ).then( function( response ) {
            var attrLOVListRes = exports.getResponseForInitialization( response, data, attr, classifyState );
            deferred.resolve( {
                attrLOVList: attrLOVListRes
            } );
        } ); // End of SOA service call
    } else {
        attrLOV = getLovValues( data, attr );
        deferred.resolve( {
            attrLOVList: data.attrLOVList
        } );
    }

    return deferred.promise;
};

export let getDependencyAttributeStruct = function( data, attr, classifyState ) {
    var dAttributeStruct = [];

    const tmpState = { ...classifyState.value };

    //list of dependent attributes IDs
    var list = attr.fielddata.lovApi.dependentAttributeIds;

    var finalList = [];
    _.forEach( list, function( listItem ) {
        var element = getAttrAtIndexInLovSet( tmpState.attrs, listItem );
        if ( element ) {
            finalList.push( element );
        }
    } );

    //now you got the list of dependnet attributes
    _.forEach( list, function( entry ) {
        var depAttrValues = [];
        _.forEach( finalList, function( element ) {
            if ( entry ) {
                // var viewPropForDepAttribute = viewPropMap[ entry ];

                var selValue = '';
                if ( element.vmps[0].dbValue && element.vmps[0].dbValue.length > 0 ) {
                    selValue = element.vmps[0].dbValue;
                }

                if ( _.isArray( element.vmps[0].dbValue ) ) {
                    selValue = element.vmps[0].dbValue[0];
                } else {
                    selValue = _.isEmpty( element.vmps[0].dbValue ) ? '' : element.vmps[0].dbValue;
                }
                depAttrValues.push( new DepAttrValues(
                    getAttributeIntegerFromString( element.id ), selValue ) );
            }
        } );

        let index = getAttrIndexInLovSet( finalList, entry );
        var selValue = '';
        if ( finalList[index].vmps[0].dbValue && finalList[index].vmps[0].dbValue.length > 0 ) {
            selValue = finalList[index].vmps[0].dbValue;
        }

        if ( _.isArray( finalList[index].vmps[0].dbValue ) ) {
            selValue = finalList[index].vmps[0].dbValue[0];
        } else {
            selValue = _.isEmpty( finalList[index].vmps[0].dbValue ) ? '' : finalList[index].vmps[0].dbValue;
        }

        dAttributeStruct.push( {
            classID: finalList[index].vmps[0].lovApi.classID,
            selectedAttributeID: finalList[index].vmps[0].lovApi.attrID,
            selectedValue: selValue,
            attributeValues: depAttrValues
        } );
    } );

    return dAttributeStruct;
};


/**
 * function to process the response
 *
 * @param {Object} response
 */
export let getResponse = function( data, response, attr, classifyState ) {
    const tmpState = { ...classifyState.value };

    if ( response ) {
        if ( response.partialErrors || response.PartialErrors ) {
            throw exports.createError( response );
        }

        if ( response.ServiceData && response.ServiceData.partialErrors ) {
            throw exports.createError( response.ServiceData );
        }

        if ( response.dependencyKeyLOVs ) {
            // Loop on each dependent KL Attribute response object.
            _.forEach( response.dependencyKeyLOVs, function( depKLEntryFromResp ) {
                // Clearing off the Earlier selected values
                if ( !depKLEntryFromResp.selectedKeys[0] ||
                    depKLEntryFromResp.keyLOVDefinition.keyLovEntries.length === 0 ) {
                    viewPropMap[depKLEntryFromResp.attributeID].uiValue = '';
                    uwPropertyService.setValue( viewPropMap[depKLEntryFromResp.attributeID], '' );
                }

                // For the current Attribute ID, populate klEntries and set the 'sel'=true for the entry matching the entry.selectedKeys[0];
                var depKLEntries = [];
                _.forEach( depKLEntryFromResp.keyLOVDefinition.keyLovEntries, function( entry ) {
                    // First, update the selected Key for this dependent attribute
                    if ( entry.lovKey === depKLEntryFromResp.selectedKeys[0] ) {
                        viewPropMap[depKLEntryFromResp.attributeID].uiValue = depKLEntryFromResp.keyLOVDefinition.options === 1 ? entry.lovValue :
                            entry.lovKey + ' ' + entry.lovValue;
                        uwPropertyService.setValue( viewPropMap[depKLEntryFromResp.attributeID], entry.lovKey );
                    }

                    var subStr = entry.lovKey.substring( 0, 1 );
                    if ( subStr !== KL_HASH_STR ) {
                        depKLEntries
                            .push( {
                                propDisplayValue: depKLEntryFromResp.keyLOVDefinition.options === 1 ? entry.lovValue : entry.lovKey + ' ' + entry.lovValue,
                                propInternalValue: entry.lovKey,
                                propDisplayDescription: '',
                                hasChildren: false,
                                children: {},
                                sel: entry.lovKey === depKLEntryFromResp.selectedKeys[0]
                            } );
                    }
                } ); // End of forEach
                // Set the newly found klEntries to the existing viewProp in the map
                viewPropMap[depKLEntryFromResp.attributeID].lovApi.klEntries = depKLEntries;
                const index = getAttrIndexInLovSet( tmpState.attrs, depKLEntryFromResp.attributeID );
                tmpState.attrs[index].vmps[0].lovApi.klEntries = depKLEntries;
            } ); //End of _forEach
        }
    }
    classifyState.update( tmpState );
};

let setLovValue = function( element, selected ) {
    // element.vmps[0].dbValue = [];
    if ( _.isArray( element.vmps[0].dbValue ) ) {
        element.vmps[0].dbValue.push( selected.propInternalValue );
    } else {
        element.vmps[0].dbValue = selected.propInternalValue;
    }
    element.vmps[0].displayValues = [];
    element.vmps[0].displayValues.push( selected.propDisplayValue );
    element.vmps[0].uiValue = selected.propDisplayValue;
};

/**
 * function to process the response
 *
 * @param {Object} response
 */
export let getResponseForInitialization = function( response, data, attr, classifyState, selected ) {
    const tmpState = { ...classifyState.value };
    if ( tmpState.attrs.length === 0 ) {
        tmpState.attrs = classifyState.attrs;
    }

    var klentries = [];

    var element = getAttrAtIndexInLovSet( tmpState.attrs, attr.fielddata.lovApi.attrID );
    element.vmps[0].dbValue = [];
    if ( selected ) {
        setLovValue( element, selected[0] );
        element.vmps[0].lovApi.lovUpdated = false;
    }

    if ( response ) {
        if ( response.partialErrors || response.PartialErrors ) {
            throw exports.createError( response );
        }

        if ( response.ServiceData && response.ServiceData.partialErrors ) {
            throw exports.createError( response.ServiceData );
        }

        if ( response.dependencyKeyLOVs ) {
            // Loop on each dependent KL Attribute response object.
            _.forEach( response.dependencyKeyLOVs, function( depKLEntryFromResp ) {
                // Clearing off the Earlier selected values
                viewPropMap[depKLEntryFromResp.attributeID].uiValue = '';
                uwPropertyService.setValue( viewPropMap[depKLEntryFromResp.attributeID], '' );
                initAttrAtIndexInLovSet( tmpState.attrs, depKLEntryFromResp.attributeID );

                // For the current Attribute ID, populate klEntries and set the 'sel'=true for the entry matching the entry.selectedKeys[0];
                var depKLEntries = [];
                _.forEach(
                    depKLEntryFromResp.keyLOVDefinition.keyLovEntries,
                    function( entry ) {
                        // First, update the selected Key for this dependent attribute
                        if ( entry.lovKey === depKLEntryFromResp.selectedKeys[0] ) {
                            viewPropMap[depKLEntryFromResp.attributeID].uiValue = depKLEntryFromResp.keyLOVDefinition.options === 1 ? entry.lovValue :
                                entry.lovKey + ' ' + entry.lovValue;
                            uwPropertyService.setValue( viewPropMap[depKLEntryFromResp.attributeID], entry.lovKey );

                            const element = getAttrAtIndexInLovSet( tmpState.attrs, depKLEntryFromResp.attributeID );
                            if ( element ) {
                                let lovEntry = {
                                    propInternalValue: entry.lovKey,
                                    propDisplayValue: entry.lovValue
                                };
                                setLovValue( element, lovEntry );
                            }
                        }

                        var subStr = entry.lovKey.substring( 0, 1 );
                        if ( subStr !== KL_HASH_STR ) {
                            depKLEntries
                                .push( {
                                    propDisplayValue: depKLEntryFromResp.keyLOVDefinition.options === 1 ? entry.lovValue : entry.lovKey + ' ' + entry.lovValue,
                                    propInternalValue: entry.lovKey,
                                    propDisplayDescription: '',
                                    hasChildren: false,
                                    children: {},
                                    selected: entry.lovKey === depKLEntryFromResp.selectedKeys[0]
                                } );
                        }
                    } ); // End of forEach
                // Set the newly found klEntries to the existing viewProp in the map
                viewPropMap[depKLEntryFromResp.attributeID].lovApi.klEntries = depKLEntries;

                var attrElement = getAttrAtIndexInLovSet( tmpState.attrs, depKLEntryFromResp.attributeID );
                if ( element.id !== attrElement.id && selected ) {
                    if ( depKLEntryFromResp.selectedKeys[0] === '' && attrElement.vmps[0].uiValue !== '' ) {
                        attrElement.vmps[0].uiValue = depKLEntryFromResp.selectedKeys[0];
                    }
                    attrElement.vmps[0].lovApi.lovUpdated = true;
                }
                attrElement.vmps[0].lovApi.klEntries = depKLEntries;
            } ); //End of _forEach
        }
    }
    classifyState.update( tmpState );
    return getLovValues( data, attr );
};


/**
 * Return lovEntry for the provided filter text if found else return null.
 *
 * @param {String} filter text.
 * @return {Object} lovEntry
 */
ClsLovApi.prototype.retrieveLovEntry = function( lovEntries, filterText ) {
    var lovEntry = null;
    for ( var i = 0; i < lovEntries.length; i++ ) {
        if ( lovEntries[i].propInternalValue === filterText ) {
            lovEntry = lovEntries[i];
            break;
        }
    }
    return lovEntry;
};

/**
 * Creates a new classification LOV api given an attribute ID
 *
 * @param {Object} data - Parent DeclviewModel
 * @param {String} classId - The selected class ID
 * @param {String} attributeId - the attribute ID to get the LOV API for.
 * @param {Object} keyLOVDefinition - The KeyLOV definition object
 * @param {Boolean} isInterDependentKeyLOV - true if the keyLOV attribute is an interdependent KeyLOV
 * @param {Object} dependentAttributeIds - the list of dependent attribute IDs
 * @param {Object} viewProp the current viewProp object
 * @param {Object} attrDepAttribute the current viewProp object
 * @returns {Object} clsLovApi
 */
export let getLOVApi = function( data, classId, attributeId, keyLOVDefinition, isInterDependentKeyLOV,
    dependentAttributeIds, viewProp, attrDepAttribute ) {
    return new ClsLovApi( data, classId, attributeId, keyLOVDefinition, isInterDependentKeyLOV,
        dependentAttributeIds, viewProp, attrDepAttribute );
};

let getAttrIndexInLovSet = function( attrSet, attrID ) {
    return _.findIndex( attrSet, function( attrNew ) {
        return attrID === getAttributeIntegerFromString( attrNew.id );
    } );
};

let getAttrAtIndexInLovSet = function( attrSet, attrID ) {
    var index = getAttrIndexInLovSet( attrSet, attrID );
    if ( index !== -1 ) {
        return attrSet[index];
    }
    return null;
};

let initAttrAtIndexInLovSet = function( attrSet, attrID ) {
    var element = getAttrAtIndexInLovSet( attrSet, attrID );
    if ( element ) {
        uwPropertyService.setValue( element.vmps[0], '' );
        element.vmps[0].lovApi.lovUpdated = false;
    }
};

/**
 * Returns true if a passed in attribute is a keylov
 *
 * @param {Object} data the data global variable
 * @param {Object} attribute - The attribute
 * @param {Object} currentUnitSystem - The unit system object of attribute
 * @param {String} metricKeyLovIrdi - The string irdi of attribute, if the unit system is metric. Only used for
 *            CST KeyLOVs.
 * @param {String} nonMetricKeyLovIrdi - The string irdi of attribute, if the unit system is non-metric. Only
 *            used for CST KeyLOVs.
 * @returns {Boolean} isKeyLov
 */
export let isKeyLov = function( data, attribute, currentUnitSystem, metricKeyLovIrdi, nonMetricKeyLovIrdi ) {
    var isKeyLov = false;
    if ( currentUnitSystem.formatDefinition.formatType === -1 ||
        metricKeyLovIrdi && metricKeyLovIrdi !== '' || nonMetricKeyLovIrdi && metricKeyLovIrdi !== '' ) {
        isKeyLov = true;
    }

    return isKeyLov;
};

/**
 * Returns the keylov id of an attribute
 *
 * @param {Object} data the data global variable
 * @param {Object} attribute - The attribute
 * @param {Object} attrDefn - attribute definition
 * @param {Boolean} isMetric - True if the current unitsystem in panel is metric, false if it is non-metric
 * @returns {String} KeyLOVId
 */
export let getKeyLOVID = function( data, attribute, attrDefn, isMetric ) {
    var KeyLOVID = null;
    var metricKeyLovIrdi = attrDefn.metricKeyLovIrdi;
    var nonMetricKeyLovIrdi = attrDefn.nonMetricKeyLovIrdi;
    var unitSystem = attrDefn.unitSystem;
    if ( metricKeyLovIrdi && metricKeyLovIrdi !== '' || nonMetricKeyLovIrdi && metricKeyLovIrdi !== '' ) {
        if ( isMetric || attrDefn.attrType === 'STRING' ) {
            KeyLOVID = metricKeyLovIrdi;
        } else {
            KeyLOVID = nonMetricKeyLovIrdi;
        }
    } else {
        KeyLOVID = unitSystem.formatDefinition.formatLength;
    }
    return KeyLOVID;
};

/**
 * Clear LOV value
 * @param {*} data data
 * @param {*} attr attribute
 */
export const clearLovValue = ( data, attr ) => {
    var lovAttr = data.attrLovLink;
    var provider = data.dataProviders.attrLOV;

    //update lov entry
    lovAttr.uiValue = attr.fielddata.uiValue;
    lovAttr.dbValue = attr.value;
    lovAttr.displayValues = attr.fielddata.displayValues;
    lovAttr.displayValsModel = attr.fielddata.displayValsModel;
    lovAttr.uiValue = attr.fielddata.uiValue;
    lovAttr.uiValues = attr.fielddata.uiValues;
    //reset current entry
    let entry = provider.getLovEntryRef();
    if ( entry ) {
        entry.current = null;
    }
};

/**
 * Clear LOV value during clear all
 *
 * @param {*} data data
 * @param {*} attr attribute
 */
export const updateLovValue = ( data, attr ) => {
    if ( attr.fielddata.lovApi && attr.fielddata.lovApi.lovUpdated ) {
        exports.clearLovValue( data, attr );
        attr.fielddata.lovApi.lovUpdated = false;
    }
    return data;
};

export default exports = {
    buildingKeyLOVEntries,
    clearLovValue,
    initializeInterdepLOV,
    initLOVDataProvider,
    isKeyLov,
    isSubmenuStart,
    isSubmenuEnd,
    getBucket,
    getDependencyAttributeStruct,
    getKeyLOVID,
    getKeyLOVsForDependentAttributes,
    getLOVApi,
    getResponse,
    getResponseForInitialization,
    processKeyLOVEntriesForLOVApi,
    processKeyLOVEntriesForLOVApiForView,
    updateLovValue,
    validateLOVValueSelections
};
