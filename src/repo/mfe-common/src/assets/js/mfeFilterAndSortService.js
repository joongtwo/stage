// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import vmoSvc from 'js/viewModelObjectService';

/**
 * mfe sort and filter service
 *
 * @module js/mfeFilterAndSortService
 */
'use strict';
const COMPARABLE_SWAP_ORDER = 1;
const COMPARABLE_KEEP_ORDER = -1;
const CAN_COMPARE_OBJECTS = 2;
const STRING = 'STRING';
const INTEGER = 'INTEGER';
const DOUBLE = 'DOUBLE';
const FLOAT = 'FLOAT';
const DATE = 'DATE';
const SHORT = 'SHORT';
const CHAR = 'CHAR';
const BOOLEAN = 'BOOLEAN';

/**
 * @param {ModelObject[]} modelObjects - a given set of modelObjects
 * @param {object[]} filters - the filters object array
 * @return {modelObject[]} a filtered array of modelObjects
 */
export function filterModelObjects( modelObjects, filters ) {
    let filteredModelObjects = modelObjects;
    if( filters ) {
        // Apply filtering
        filters.forEach( ( filter ) => {
            filteredModelObjects = filterDispatcher( filter, filteredModelObjects );
        } );
    }
    return filteredModelObjects;
}

/**
 * * This function filters text data with the 'contains' operation.
 *
 * @param {Object} filter Filter to apply
 * @param {ModelObject[]} modelObjects - a given set of modelObjects
 * @return {modelObject[]} a filtered array of modelObjects
 */
function processContainsFilter( filter, modelObjects ) {
    const filterValue = filter.values[ 0 ].toLowerCase();
    return modelObjects.filter( ( modelObject ) => {
        if( modelObject.props[ filter.columnName ] && modelObject.props[ filter.columnName ].uiValues[ 0 ] ) {
            return modelObject.props[ filter.columnName ].uiValues[0].toLowerCase().indexOf( filterValue ) !== -1;
        }
    } );
}

/**
 * * This function filters text data with the 'does not contains' operation.
 *
 * @param {Object} filter Filter to apply
 * @param {ModelObject[]} modelObjects - a given set of modelObjects
 * @return {modelObject[]} a filtered array of modelObjects
 */
function processNotContainsFilter( filter, modelObjects ) {
    const filterValue = filter.values[ 0 ].toLowerCase();
    return modelObjects.filter( ( modelObject ) => {
        if( modelObject.props[ filter.columnName ] && modelObject.props[ filter.columnName ].uiValues[ 0 ] ) {
            return modelObject.props[ filter.columnName ].uiValues[0].toLowerCase().indexOf( filterValue ) === -1;
        }
    } );
}

/**
 * * This function filters text data with the 'Begins with' operation.
 *
 * @param {Object} filter Filter to apply
 * @param {ModelObject[]} modelObjects - a given set of modelObjects
 * @return {modelObject[]} a filtered array of modelObjects
 */
function processStartsWithFilter( filter, modelObjects ) {
    const filterValue = filter.values[ 0 ].toLowerCase();
    return modelObjects.filter( ( modelObject ) => {
        if( modelObject.props[ filter.columnName ] && modelObject.props[ filter.columnName ].uiValues[ 0 ] ) {
            return modelObject.props[ filter.columnName ].uiValues[0].toLowerCase().indexOf( filterValue ) === 0;
        }
    } );
}
/**
 * * This function filters text data with the 'Ends with' operation.
 *
 * @param {Object} filter Filter to apply
 * @param {ModelObject[]} modelObjects - a given set of modelObjects
 * @return {modelObject[]} a filtered array of modelObjects
 */
function processEndsWithFilter( filter, modelObjects ) {
    const filterValue = filter.values[ 0 ].toLowerCase();
    return modelObjects.filter( ( modelObject ) => {
        if( modelObject.props[ filter.columnName ] && modelObject.props[ filter.columnName ].uiValues[ 0 ] ) {
            const propValInLower = modelObject.props[ filter.columnName ].uiValues[0].toLowerCase();
            return propValInLower.lastIndexOf( filterValue ) === propValInLower.length - filterValue.length;
        }
    } );
}
/**
 * * This function filters text data with the 'Equals' operation.
 *
 * @param {Object} filter Filter to apply
 * @param {ModelObject[]} modelObjects - a given set of modelObjects
 * @return {modelObject[]} a filtered array of modelObjects
 */
function processEqualsFilter( filter, modelObjects ) {
    const filterValue = filter.values[ 0 ].toLowerCase();
    return modelObjects.filter( ( modelObject ) => {
        if( modelObject.props[ filter.columnName ] && modelObject.props[ filter.columnName ].uiValues[ 0 ] ) {
            return modelObject.props[ filter.columnName ].uiValues[0].toLowerCase() === filterValue;
        }
    } );
}
/**
 * * This function filters text data with the 'does not equals' operation.
 *
 * @param {Object} filter Filter to apply
 * @param {ModelObject[]} modelObjects - a given set of modelObjects
 * @return {modelObject[]} a filtered array of modelObjects
 */
function processNotEqualsFilter( filter, modelObjects ) {
    const filterValue = filter.values[ 0 ].toLowerCase();
    return modelObjects.filter( ( modelObject ) => {
        if( modelObject.props[ filter.columnName ] && modelObject.props[ filter.columnName ].uiValues[ 0 ] ) {
            return modelObject.props[ filter.columnName ].uiValues[0].toLowerCase() !== filterValue;
        }
    } );
}

/**
 * This function applies the 'Equals' condition.
 *
 * @param {Object} unfilteredValue value to filter
 * @param {Object} filterValue filter value
 * @return {boolean} if condition is met
 */
function numericEqualsFilteringCondition( unfilteredValue, filterValue ) {
    return  Number( unfilteredValue ) === filterValue;
}

/**
 * This function applies the 'Greater than' condition.
 *
 * @param {Object} unfilteredValue value to filter
 * @param {Object} filterValue filter value
 * @return {boolean} if condition is met
 */
function numericGreaterThanFilteringCondition( unfilteredValue, filterValue ) {
    return  Number( unfilteredValue ) > filterValue;
}

/**
 * This function applies the 'Less than' condition.
 *
 * @param {Object} unfilteredValue value to filter
 * @param {Object} filterValue filter value
 * @return {boolean} if condition is met
 */
function numericLessThanFilteringCondition( unfilteredValue, filterValue ) {
    return  Number( unfilteredValue ) < filterValue;
}

/**
 * This function applies the 'Range' condition.
 *
 * @param {Object} unfilteredValue value to filter
 * @param {Object} fromValue filter value
 * @param {Object} toValue filter value
 * @return {boolean} if condition is met
 */
function numericRangeFilteringCondition( unfilteredValue, fromValue,  toValue ) {
    return Number( unfilteredValue ) >= fromValue && Number( unfilteredValue ) <= toValue;
}

/**
 * This function filters date data with the 'Range' operation.
 *
 * @param {Object} filter Filter to apply
 * @param {ModelObject[]} modelObjects - a given set of modelObjects
 * @return {ModelObject} The modelObject that matches the filter
 */
function processDateRangeFilter( filter, modelObjects ) {
    const fromValue = filter.values[ 0 ];
    const toValue = filter.values[ 1 ];
    const fromDate = new Date( fromValue ).getTime();
    const toDate = new Date( toValue ).getTime();
    return modelObjects.filter( ( modelObject ) => {
        const unfilteredValue = new Date( modelObject.props[ filter.columnName ].dbValues[0] ).getTime();
        return unfilteredValue >= fromDate && unfilteredValue <= toDate;
    } );
}

/**
 * the function filters the model objects according to the appropriate condition function
 *
 * @param {Object} filter Filter to apply
 * @param {ModelObject[]} modelObjects - a given set of modelObjects
 * @return {function} a condition function name
 */
function numericFilteringConditionDispatcher( filter, modelObjects, conditionFunc ) {
    const fromValue = Number( filter.values[ 0 ] );
    const toValue =  Number( filter.values[ 1 ] );
    return modelObjects.filter( ( modelObject ) => {
        const unfilteredValue = modelObject.props[ filter.columnName ].dbValues[0];
        return unfilteredValue && conditionFunc( unfilteredValue, fromValue, toValue );
    } );
}


/**
 * the function decides to which text filter to dispatch the modelobjects
 *
 * @param {Object} filter Filter to apply
 * @param {ModelObject[]} modelObjects - a given set of modelObjects
 * @return {ModelObject[]} a filtered array of modelObjects
 */
function textFiltersManager( filter, modelObjects ) {
    switch ( filter.operation ) {
        case 'contains':
            modelObjects = processContainsFilter( filter, modelObjects );
            break;
        case 'notContains':
            modelObjects = processNotContainsFilter( filter, modelObjects );
            break;
        case 'startsWith':
            modelObjects = processStartsWithFilter( filter, modelObjects );
            break;
        case 'endsWith':
            modelObjects = processEndsWithFilter( filter, modelObjects );
            break;
        case 'equals':
            modelObjects = processEqualsFilter( filter, modelObjects );
            break;
        case 'notEquals':
            modelObjects = processNotEqualsFilter( filter, modelObjects );
            break;
        default:
            break;
    }
    return modelObjects;
}

/**
 * the function decides to which numeric filter to dispatch the modelobjects
 *
 * @param {Object} filter Filter to apply
 * @param {ModelObject[]} modelObjects - a given set of modelObjects
 * @return {ModelObject[]} a filtered array of modelObjects
 */
function numericFiltersManager( filter, modelObjects ) {
    switch ( filter.operation ) {
        case 'equals':
            modelObjects = numericFilteringConditionDispatcher( filter, modelObjects, numericEqualsFilteringCondition );
            break;
        case 'gt':
            modelObjects = numericFilteringConditionDispatcher( filter, modelObjects, numericGreaterThanFilteringCondition );
            break;
        case 'lt':
            modelObjects = numericFilteringConditionDispatcher( filter, modelObjects, numericLessThanFilteringCondition );
            break;
        case 'range':
            modelObjects = numericFilteringConditionDispatcher( filter, modelObjects, numericRangeFilteringCondition );
            break;
        default:
            break;
    }
    return modelObjects;
}

/**
 * the function decides to which date filter to dispatch the modelobjects
 *
 * @param {Object} filter Filter to apply
 * @param {ModelObject[]} modelObjects - a given set of modelObjects
 * @return {ModelObject[]} a filtered array of modelObjects
 */
function dateFiltersManager( filter, modelObjects ) {
    if ( filter.operation === 'range'  ) {
        modelObjects = processDateRangeFilter( filter, modelObjects );
    }
    return modelObjects;
}

/**
 * Given a filter and the unfiltered array of modelObjects, this method dispatches them to the right filters manager
 *
 * @param {Object} filter Filter to apply
 * @param {ModelObject[]} modelObjects - a given set of modelObjects
 * @return {ModelObject[]} a filtered array of modelObjects
 */
function filterDispatcher( filter, modelObjects ) {
    let valueType = '';
    for( let i = 0; i < modelObjects.length; i++ ) {
        let property = modelObjects[i].props[ filter.columnName ];
        if( property && property.propertyDescriptor && property.propertyDescriptor.valueType ) {
            valueType = vmoSvc.getClientPropertyType( property.propertyDescriptor.valueType );
            break;
        }
    }
    switch( valueType ) {
        case INTEGER:
        case DOUBLE:
        case FLOAT:
        case SHORT:
            modelObjects = numericFiltersManager( filter, modelObjects );
            break;
        case DATE:
            modelObjects = dateFiltersManager( filter, modelObjects );
            break;
        case STRING:
        case CHAR:
        case BOOLEAN:
            modelObjects = textFiltersManager( filter, modelObjects );
            break;
        default:
            break;
    }
    return modelObjects;
}

/**
 * @param {modelObject[]} modelObjects - an array of modelobjects
 * @param {object[]} sortCriteria - the sort criteria object array
 * @return {modelObject[]} a sorted array of modelObjects
 */
export function sortModelObjects( modelObjects, sortCriteria ) {
    let sortedModelObjects = modelObjects;
    if( Array.isArray( modelObjects ) && modelObjects.length > 1 && Array.isArray( sortCriteria ) && sortCriteria.length > 0 ) {
        const { fieldName, sortDirection } = sortCriteria[ 0 ];
        sortedModelObjects = sortModelObjectsByProp( modelObjects, fieldName, sortDirection === 'ASC' );
    }
    return sortedModelObjects;
}

/**
 * Given an array of modelObjects, this method sorts them by a property value
 *
 * @param {ModelObject[]} modelObjects - a given set of modelObjects
 * @param {string} sortByProp - the property to sort by
 * @param {boolean} ascending - true if the sort should be in ascending order
 * @return {ModelObject[]} - a sorted array based on a given property value
 */
export function sortModelObjectsByProp( modelObjects, sortByProp, ascending ) {
    if( Array.isArray( modelObjects ) && modelObjects.length > 1 && sortByProp ) {
        return modelObjects.sort( ( obj1, obj2 ) => {
            if( obj1.props[ sortByProp ] && !obj2.props[ sortByProp ] ) {
                return ascending ? COMPARABLE_KEEP_ORDER : COMPARABLE_SWAP_ORDER;
            }
            if( !obj1.props[ sortByProp ] && obj2.props[ sortByProp ] ) {
                return ascending ? COMPARABLE_SWAP_ORDER : COMPARABLE_KEEP_ORDER;
            }
            if( !obj1.props[ sortByProp ] && !obj2.props[ sortByProp ] ) {
                return 0;
            }
            let valueType;
            if( obj1.props[ sortByProp ].propertyDescriptor && obj1.props[ sortByProp ].propertyDescriptor.valueType ) {
                valueType = vmoSvc.getClientPropertyType( obj1.props[ sortByProp ].propertyDescriptor.valueType );
            }
            let val1 = obj1.props[ sortByProp ].uiValues[ 0 ];
            let val2 = obj2.props[ sortByProp ].uiValues[ 0 ];
            if( valueType === INTEGER || valueType === DOUBLE || valueType === FLOAT || valueType === SHORT ) {
                val1 = Number( obj1.props[ sortByProp ].dbValues[ 0 ] );
                val2 = Number( obj2.props[ sortByProp ].dbValues[ 0 ] );
            } else if( valueType === DATE ) {
                val1 = obj1.props[ sortByProp ].dbValues[ 0 ];
                val2 = obj2.props[ sortByProp ].dbValues[ 0 ];
            }
            return valueComparator( val1, val2, ascending );
        } );
    }
    return modelObjects;
}

/**
 * Given an array of modelObjects, this method converts the string prop value into a number and sorts model objects
 *
 * @param {ModelObject[]} modelObjects - a given set of modelObjects
 * @param {string} sortByProp - the property to sort by
 * @param {boolean} ascending - true if the sort should be in ascending order
 * @return {ModelObject[]} - a sorted array based on a given property value
 */
function sortModelObjectsByNumericProp( modelObjects, sortByProp, ascending ) {
    if( Array.isArray( modelObjects ) && modelObjects.length > 1 && sortByProp ) {
        return modelObjects.sort( ( obj1, obj2 ) => {
            const isCompareable =  validateModelObjsForComparison( obj1, obj2, sortByProp, ascending );
            if  ( isCompareable !==  CAN_COMPARE_OBJECTS  ) {
                return isCompareable;
            }
            let val1 = Number( obj1.props[ sortByProp ].dbValues[ 0 ] );
            let val2 = Number( obj2.props[ sortByProp ].dbValues[ 0 ] );
            return valueComparator( val1, val2, ascending );
        } );
    }
    return modelObjects;
}

/**
 *
 * @param {ModelObject} obj1 - model object1
 * @param {ModelObject} obj2  - model object2
 * @param {string} sortByProp - the property to sort by
 * @param {boolean} ascending - true if the sort should be in ascending order
 * @returns {int} value comparator
 */
function validateModelObjsForComparison( obj1, obj2, sortByProp, ascending ) {
    if( obj1.props[ sortByProp ] && !obj2.props[ sortByProp ] ) {
        return ascending ? COMPARABLE_KEEP_ORDER : COMPARABLE_SWAP_ORDER;
    }
    if( !obj1.props[ sortByProp ] && obj2.props[ sortByProp ] ) {
        return ascending ? COMPARABLE_SWAP_ORDER : COMPARABLE_KEEP_ORDER;
    }
    if( !obj1.props[ sortByProp ] && !obj2.props[ sortByProp ] ) {
        return 0;
    }
    return CAN_COMPARE_OBJECTS;
}


/**
 *
 * @param {primitive} val1 - some value
 * @param {primitive} val2 - some value
 * @param {boolean} ascending - true if compare in ascending
 * @return {number} a number which states which value is bigger
 */
function valueComparator( val1, val2, ascending ) {
    if( ascending ) {
        return val1 >= val2 ? COMPARABLE_SWAP_ORDER : COMPARABLE_KEEP_ORDER;
    }
    // here if we're in descending mode
    return val1 <= val2 ? COMPARABLE_SWAP_ORDER : COMPARABLE_KEEP_ORDER;
}

let exports = {};
export default exports = {
    filterModelObjects,
    sortModelObjects,
    sortModelObjectsByProp,
    sortModelObjectsByNumericProp
};
