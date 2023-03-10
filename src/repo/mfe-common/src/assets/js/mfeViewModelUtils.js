// @<COPYRIGHT>@
// ==================================================
// Copyright 2020.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

import _ from 'lodash';
import awPromiseService from 'js/awPromiseService';
import appCtxService from 'js/appCtxService';

/**
 * Mfe View Model service
 *
 * @module js/mfeViewModelUtils
 */

/**
 *
 * @param {Object} data - a given object
 * @param {string} propName - the key to save in the given object
 * @param {Object} updatedValues - a value to save under the given key in the given object
 */
export function setValueInViewModel( data, propName, updatedValues ) {
    if( data && data.dispatch && typeof data.dispatch === 'function' ) {
        let inputObject = { ... data[propName] };
        Object.assign( inputObject, updatedValues );
        data.dispatch( { path:'data.' + propName, value: inputObject } );
    }
}

/**
 *
 * @param {object} object - a given object
 * @param {string} path - the given path
 * @param {any} value - a value to save under the given key in the given object
 * @returns {object} a clone of the give "object" argument.
 */
export function mergeValueInViewModelUsingPath( object, path, value ) {
    if( typeof object === 'object' && typeof path === 'string' ) {
        let cloneObj = _.cloneDeep( object );
        const objectToMerge = _.get( cloneObj, path );
        Object.assign( objectToMerge, value );
        _.set( cloneObj, path, objectToMerge );
        return cloneObj;
    }
    return object;
}

/**
 * Get the Value from viewModel and set it on Data
 *
 * @param {Object} value value
 * @returns {Object} value
 */
export function getValueInViewModel( value ) {
    return value;
}

/**
 *
 * @param {Object} targetObj - the target object to merge to
 * @param {Object} sourceObj - the source object to merge from
 * @return {Object} a clone of the give "targetObj" argument.
 */
export function mergeValueInViewModel( targetObj, sourceObj ) {
    if( targetObj && sourceObj && typeof sourceObj === 'object' ) {
        let cloneObj = _.cloneDeep( targetObj );
        Object.assign( cloneObj, sourceObj );
        return cloneObj;
    }
    return targetObj;
}

/**
 *
 * @param {string} IdName - a given id name
 * @return {string} a random and unique ID
 */
export function generateUniqueId( IdName ) {
    return `${IdName}${Math.random().toString()}`;
}

/**
 *
 * @param {ViewModelObject} vmo - a given viewModelObject
 * @param {string} propName - the property name we want to update
 * @param {any} dbValue - the dbValue of the property
 * @param {string} uiValue - the uiValue of the property
 * @param {string} displayValue - the display value of the property
 * @param {any} value - the value of the property
 */
export function updatePropValue( vmo, propName, dbValue, uiValue, displayValue, value ) {
    const mergeObj = {
        dbValues : [ dbValue ],
        dbValue : dbValue,
        uiValues : [ uiValue ],
        uiValue : uiValue,
        displayValues : [ displayValue ],
        displayValue : displayValue,
        value
    };
    Object.assign( vmo.props[propName], mergeObj );
}

/**
 *
 * @param {boolean} booleanToToggle - a given boolean value to toggle
 * @return {boolean} the opposite of the given boolean
 */
export function getToggledBoolean( booleanToToggle ) {
    return !booleanToToggle;
}

/**
 *
 * @param {object} object - a given object
 * @param {string} key - the key we want to save in the given object
 * @param {any} preDelayValue - the value to set before delaying
 * @param {any} postDelayValue - the value to set after delaying
 * @param {number} delayTime - the delay time
 * @returns {promise} a promise resolved to undefined
 */
export function setTimeoutDelay( object, key, preDelayValue, postDelayValue, delayTime = 200 ) {
    setValueInViewModel( object, key, preDelayValue );
    const deferred = awPromiseService.instance.defer();
    setTimeout( ()=> {
        setValueInViewModel( object, key, postDelayValue );
        deferred.resolve();
    }, delayTime );
    return deferred.promise;
}

/**
 *
 * @param {Object} vmProp view model property
 * @param {Array} displayValues display value to be updated
 * @returns {Object} view model property after updating display value
 */
function updateDisplayValue( vmProp, displayValues ) {
    const newVmProp = _.clone( vmProp );
    newVmProp.uiValue = displayValues ? displayValues[0] : '';
    return newVmProp;
}

/**
 * Utility method to remove array of contexts from ctx simultaneously
 */
export function removeContextsFromCtx( contextPaths ) {
    if( contextPaths && contextPaths.length > 0 ) {
        contextPaths.forEach( path => {
            appCtxService.unRegisterCtx( path );
        } );
    }
}

/**
 *
 * @param {Object} targetAtomicData targetAtomicData
 * @param {Object} updatedValues updatedValues
 */
export function mergeValueInAtomicData( targetAtomicData, updatedValues ) {
    if ( targetAtomicData ) {
        let targetAtomicDataValue = { ...targetAtomicData.getValue() };
        let newValues = Object.assign( targetAtomicDataValue, updatedValues );
        targetAtomicData.update( newValues );
    }
}


let exports = {};
export default exports = {
    setValueInViewModel,
    mergeValueInViewModel,
    generateUniqueId,
    getToggledBoolean,
    updatePropValue,
    setTimeoutDelay,
    getValueInViewModel,
    mergeValueInViewModelUsingPath,
    updateDisplayValue,
    removeContextsFromCtx,
    mergeValueInAtomicData
};
