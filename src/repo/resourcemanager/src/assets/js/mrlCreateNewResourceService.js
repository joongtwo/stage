// Copyright (c) 2022 Siemens

/**
 * @module js/mrlCreateNewResourceService
 */
import _ from 'lodash';
import classifySvc from 'js/classifyService';

var exports = {};

//Find all non empty block properties (nested blocks) of a classification object
function findAllBlockPropertyValues( blockDM, classificationProps ) {
    _.forEach( blockDM.blocks, function( block ) {
        _.forEach( block.properties, function( prop ) {
            var valuesCount = prop.values.length;
            if ( valuesCount > 0 ) {
                classificationProps.push( prop );
            }
        } );

        //A block may have another blockDataMap
        if ( block.blockDataMap ) {
            _.forEach( block.blockDataMap, function( blockDM ) {
                findAllBlockPropertyValues( blockDM, classificationProps );
            } );
        }
    } );
}

/**
 * It returns classification properties (including ICO properteis if "isCopyValues" is true) to use classify an object.
 */
export let getClassificationProperties = function( clsClassDescriptors, clsObjectDefs, isCopyValues ) {
    var classificationProps = [];
    if ( clsObjectDefs ) {
        var classificationObj = clsObjectDefs[1][0].clsObjects[0];
        var nonBlockOrClassProperties = classificationObj.properties;
        var icoClassId = classifySvc.getPropertyValue( nonBlockOrClassProperties, classifySvc.UNCT_CLASS_ID );
        var icoClassUnitSystem = classifySvc.getPropertyValue( nonBlockOrClassProperties, classifySvc.UNCT_CLASS_UNIT_SYSTEM );

        classificationProps.push( {
            propertyId: classifySvc.UNCT_ICO_UID,
            propertyName: '',
            values: [
                {
                    internalValue: '',
                    displayValue: ''
                }
            ]
        } );

        classificationProps.push( {
            propertyId: classifySvc.UNCT_CLASS_ID,
            propertyName: '',
            values: [
                {
                    internalValue: icoClassId,
                    displayValue: icoClassId
                }
            ]
        } );

        classificationProps.push( {
            propertyId: classifySvc.UNCT_CLASS_UNIT_SYSTEM,
            propertyName: '',
            values: [
                {
                    internalValue: icoClassUnitSystem,
                    displayValue: icoClassUnitSystem
                }
            ]
        } );

        if ( isCopyValues ) {
            //Find list of ico attributes, they may be block ids or
            //attribute's id which is not added in any block.
            var listOfICOAttributesId = [];
            var icoAttributeId;
            if ( clsClassDescriptors ) {
                var icoAttributes = clsClassDescriptors[icoClassId].attributes;
                if ( icoAttributes ) {
                    for ( var idx = 0; idx < icoAttributes.length; idx++ ) {
                        icoAttributeId = icoAttributes[idx].attributeId;
                        listOfICOAttributesId.push( icoAttributeId );
                    }
                }
            }
            //Get non empty ICO properties which are not from any block.                     
            for ( var idx = 0; idx < nonBlockOrClassProperties.length; idx++ ) {
                var valuesCount = nonBlockOrClassProperties[idx].values.length;
                if ( valuesCount > 0 ) {
                    if ( listOfICOAttributesId.includes( nonBlockOrClassProperties[idx].propertyId ) ) {
                        classificationProps.push( nonBlockOrClassProperties[idx] );
                    }
                }
            }
            //Get non empty ICO properties from blocks if there are blocks defined for the ICO class.          
            _.forEach( classificationObj.blockDataMap, function( blockDM ) {
                findAllBlockPropertyValues( blockDM, classificationProps );
            } );
        }
    }

    return classificationProps;
};

/**
 * It updates status of "Copy Values" Option based on status of "Classify in Same Class" option.
 */
export let updateCopyValuesOption = function( classifyInSameClass, copyValues ) {
    const newCopyValues = _.clone( copyValues );
    if ( classifyInSameClass.dbValue ) {
        newCopyValues.isEditable = true;
    } else {
        newCopyValues.isEditable = false;
        newCopyValues.dbValue = false;
    }

    return newCopyValues;
};

/**
 * Create new resource service
 */

export default exports = {
    getClassificationProperties,
    updateCopyValuesOption
};
