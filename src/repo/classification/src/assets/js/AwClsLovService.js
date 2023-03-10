// Copyright (c) 2022 Siemens

/**
 * Defines {@link AwClsLovService}
 *
 * @module js/AwClsLovService
 */
import _ from 'lodash';
import AwWidgetVal from 'viewmodel/AwWidgetValViewModel';
import classifyLOVService from './classifyLOVService';
import classifySvc from 'js/classifyService';

/**
 * Load LOV values from lovAPI
 * @param {*} data view model
 * @param {*} attr LOV attribute to be initialized
 */
export const initSimpleLOVDataProvider = ( data,  attr, instIndex ) => {
    data.attrLovLink.valueUpdated = false;
    let attrLOV = classifyLOVService.initLOVDataProvider( data,  attr, instIndex );
    return {
        attrLOVList: attrLOV,
        lovInitialized: true
    };
};

/**
 * Get index of the root attribute for polymorphic attribute
 * @param {Object} classifyState classify state
 * @param {Object} polymorphicAttribute selected polymorphic attribute
 * @returns {Integer} returns index of the root attribute of the selected polymorphic attribute
 */
const getRootIndex = ( classifyState, polymorphicAttribute ) => {
    let rootId = '';
    if ( polymorphicAttribute.prefix !== '' ) {
        let idChunks = polymorphicAttribute.prefix.split( '.' );
        if ( idChunks.length > 0 ) {
            rootId = idChunks[ 0 ];
        }
    } else {
        rootId = polymorphicAttribute.id;
        var index = rootId.lastIndexOf( '*' );
        if ( index !== -1 ) {
            rootId = rootId.substring( 0, index );
        }
    }
    return _.findIndex( classifyState.attrs, function( attribute ) {
        return attribute.id === rootId;
    } );
};

let updateAttr = ( attr, selectedLov ) => {
    if( attr.fielddata.isArray ) {
        var propIntValues = [];
        _.forEach( selectedLov, function( selLov ) {
            propIntValues.push( selLov.propInternalValue );
        } );
        attr.update( propIntValues );
    }else {
        attr.update( selectedLov.propInternalValue );
    }
};

/**
 * Updates attribute with children based on polymorphic value
 * @param {*} data data view model
 * @param {*} attr attribute selected LOV attribute
 * @param {*} instIndex instance index in case of cardinal blocks
 * @param {*} propDetails prop details which contains parent details for nested props
 * @param {*} classifyState classify state
 * @param {*} responseState response state
 * @param {*} entry selected lov entry
 */
export const updateAttrValue = ( data, attr, instIndex, propDetails, classifyState, responseState, entry ) => {
    let cardinalAttribute = propDetails.cardinalAttribute;
    let currentLov = data.attrLovLink.dbValue;
    let entryDisplayName = entry.viewModelProp.propertyDisplayName;
    let selectedLov = attr.fielddata.isArray ? entry.selectedObjects : entry.selectedObjects[0];

    if ( currentLov && selectedLov && entryDisplayName === attr.label ) {
        if ( cardinalAttribute ) {
            //copy values from response state to data
            data.selectedClass = classifyState.value.selectedClass;
            data.keyLOVDefinitionMapResponse = data.keyLOVDefinitionMapResponse ? data.keyLOVDefinitionMapResponse :
                responseState.response.keyLOVDescriptors;
            data.blockDefinitionMapResponse = data.blockDefinitionMapResponse ? data.blockDefinitionMapResponse :
                responseState.response.clsBlockDescriptors;
            data.unitSystem = data.unitSystem ? data.unitSystem : classifyState.value.currentUnitSystem;
            let rootIndex = getRootIndex( classifyState, cardinalAttribute );
            let rootAttribute = classifyState.attrs[ rootIndex ];
            let polyAttribute = cardinalAttribute.polymorphicTypeProperty;
            let attrIndex = parseInt( instIndex );
            if ( attrIndex !== -1 ) {
                if ( selectedLov.attrIndex === attrIndex ) {
                    if ( polyAttribute ) {
                        if ( polyAttribute.id !== attr.name &&
                                polyAttribute.name !== attr.label ) {
                            //find the polymorphic child
                            let index = _.findIndex( cardinalAttribute.children, function( child ) {
                                return child.name === attr.label && child.id === attr.name;
                            } );
                            let child = cardinalAttribute.children[index];
                            child.vmps[0].dbValue = selectedLov.propInternalValue;
                            child.vmps[0].valueUpdated = true;
                        } else {
                            classifySvc.selectPolyLOV( data, responseState, selectedLov, cardinalAttribute );
                        }
                        updatePolymorphicChildren( classifyState, rootAttribute, cardinalAttribute );
                    }
                    // attr.fielddata.uiValue =  selectedLov.propDisplayValue;
                    attr.update( selectedLov.propInternalValue );
                }
            } else if ( polyAttribute ) {
                if ( rootAttribute.id === cardinalAttribute.id ) {
                    classifySvc.selectPolyLOV( data, responseState, selectedLov, rootAttribute );
                    updatePolymorphicChildren( classifyState, rootAttribute );
                } else {
                    classifySvc.selectPolyLOV( data, responseState, selectedLov, cardinalAttribute );
                    updatePolymorphicChildren( classifyState, rootAttribute, cardinalAttribute );
                }
                attr.update( selectedLov.propInternalValue );
            } else {
                updateAttr( attr, selectedLov );
            }
        } else {
            updateAttr( attr, selectedLov );
        }
    }
};

/**
 * Update classifyState with new polymorphic children
 * @param {*} classifyState classify state
 * @param {*} polymorphicAttribute selected polymorphic attribute
 * @param {*} instanceAttribute instance attribute
 */
export const updatePolymorphicChildren = ( classifyState, polymorphicAttribute, instanceAttribute ) => {
    let tmpState;
    tmpState = { ...polymorphicAttribute.value };
    tmpState.children = polymorphicAttribute.children;
    tmpState.instances = polymorphicAttribute.instances;
    if ( !instanceAttribute ) {
        tmpState.blockId = polymorphicAttribute.blockId;
    }
    polymorphicAttribute.update( tmpState );
    if ( classifyState.selectedPropertyGroup && classifyState.selectedPropertyGroup[0].id === polymorphicAttribute.id ) {
        let tmpClassifyState = { ...classifyState.value };
        tmpClassifyState.selectedPropertyGroup[0] = polymorphicAttribute;
        classifyState.update( tmpClassifyState );
    }
};

/**
 * render function for AwClsLOV
 * @param {*} props context for render function interpolation
 * @returns {JSX.Element} react component
 */
export const awClsLovServiceRenderFunction = (  props ) => {
    const { fields, attr, ...prop } = props;

    let currentLov;

    if( attr.value !== null && attr.value.length > 0 ) {
        currentLov = attr.fielddata.lovApi.keyLOVDefinition.keyLOVEntries.filter( function( entry ) {
            if ( entry.keyLOVkey === attr.value || attr.fielddata.isArray && entry.keyLOVkey === attr.value[0] ||
                _.isArray( attr.value ) && entry.keyLOVkey === attr.value[0] ) {
                return entry;
            }
        } );
    }

    if ( currentLov && currentLov.length > 0 ) {
        fields.attrLovLink.value = currentLov[0].keyLOVkey;

        fields.attrLovLink.fielddata.uiValue = attr.fielddata.lovApi.keyLOVDefinition.keyLOVOptions === 1 ? currentLov[0].keyLOVValue : `${currentLov[0].keyLOVkey} ${currentLov[0].keyLOVValue}`;
        fields.attrLovLink.checked = attr.checked;
    }

    if( fields.attrLovLink.fielddata.displayValues.length === 0 ) {
        fields.attrLovLink.fielddata.displayValsModel = attr.fielddata.displayValsModel;
        fields.attrLovLink.fielddata.displayValues = attr.fielddata.displayValues;
    }

    return (
        <AwWidgetVal { ...fields.attrLovLink }></AwWidgetVal>
    );
};
