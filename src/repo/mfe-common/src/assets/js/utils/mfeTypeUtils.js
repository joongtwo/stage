//@<COPYRIGHT>@
//==================================================
//Copyright 2020.
//Siemens Product Lifecycle Management Software Inc.
//All Rights Reserved.
//==================================================
//@<COPYRIGHT>@

import cmm from 'soa/kernel/clientMetaModel';
import _ from 'lodash';

/**
 * @module js/utils/mfeTypeUtils
 */


/**
 *
 * @param {modelObject} modelObject - a given model object
 * @param {string[]} typeNames - array of type names
 * @return {boolean} true if a given modelObject is one of the given types
 */
export function isOfTypes( modelObject, typeNames ) {
    if( !modelObject || !typeNames ) {
        return false;
    }
    if( Array.isArray( typeNames ) ) {
        for( let idx in typeNames ) {
            if( isOfType( modelObject, typeNames[ idx ] ) ) {
                return true;
            }
        }
    } else {
        return isOfType( modelObject, typeNames );
    }
    return false;
}

/**
 *
 * @param {modelObject} modelObject - a given modelObject
 * @param {string} typeName - the type name
 * @return {boolean} true if a given modelObject is one of the given type
 */
export function isOfType( modelObject, typeName ) {
    if( !modelObject || !typeName ) {
        return false;
    }
    if( modelObject.type === typeName ) {
        return true;
    }
    let modelType = modelObject.modelType || cmm.getType( modelObject.type );
    return cmm.isInstanceOf( typeName, modelType );
}

/**
 *
 * @param {modelObject} modelObject - a given modelObject
 * @param {string[]} typeNames - array of type names
 * @return {string} the base type name
 */
export function getBaseTypeOfObject( modelObject, typeNames ) {
    if( !modelObject || !typeNames ) {
        return null;
    }
    if( _.includes( typeNames, modelObject.type ) ) {
        return modelObject.type;
    }

    let baseType;
    if( Array.isArray( typeNames ) ) {
        typeNames.every( ( type ) => {
            if( isOfType( modelObject, type ) ) {
                baseType = type;
                return false;
            }
            return true;
        } );
    }
    return baseType;
}
/**
 *
 * @param {string} typeName - the given type name
 * @return {modelType} the modelType of the given type name
 */
export function getModelType( typeName ) {
    return Boolean( typeName ) && cmm.getType( typeName );
}

export default {
    isOfTypes,
    isOfType,
    getBaseTypeOfObject,
    getModelType
};
