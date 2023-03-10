// Copyright (c) 2022 Siemens

/**
 * Defines {@link AwClsAttributeAnnotationService}
 *
 * @module js/AwClsAttributeAnnotationService
 */
import AwClsAttributes from 'viewmodel/AwClsAttributesViewModel';
import dataProviderFactory from 'js/dataProviderFactory';
import declDataProviderSvc from 'js/declDataProviderService';

var exports = {};


export const createUnitsProvider = function( attrName, unitProp ) {
    var dataProviderJson = {
        dataProviderType: 'Static',
        response: unitProp.names, // Populate the response array with the values in current display.
        totalFound: unitProp.lovApi.length
    };
    return dataProviderFactory.createDataProvider( dataProviderJson,
        null, attrName, declDataProviderSvc );
};


export const initialize = function( attribute ) {
    // unitState field is initialized with attribute.vmps[2] and
    // passed to AwClsAttributes component thorugh unitLink prop.
    return {
        attrVmps: attribute.vmps,
        unitLink: attribute.vmps[2]
    };
};


/**
 * render function for AwClsAttributeAnnotation
 * @param {*} props props
 * @returns {JSX.Element} react component
 */

export const awClsAttrAnnoServiceRenderFunction = ( props ) => {
    const {  fields, classifyState, responseState, ...prop } = props;
    let minMaxMsg = '';
    let labelProps = '';
    if ( prop.attr.vmps ) {
        minMaxMsg = prop.attr.vmps[0].minMaxMsg;
        labelProps = props.attr.vmps[0].labelProps;
    }

    let propDetails = prop.propDetails ? prop.propDetails : {};
    propDetails.parentAttribute = prop.attr;
    propDetails.showMinmaxMsg = minMaxMsg;
    propDetails.labelProps = labelProps;
    propDetails.isMandatory = prop.attr.vmps ? prop.attr.vmps[0].isRequired : false;

    if( prop.attr.vmps && fields.unitState.value.unitProp !== prop.attr.name ) {
        fields.unitState.value = prop.attr.vmps[2];
    }

    return (
        <div>
            {fields.attrVmps && <div>
                <AwClsAttributes
                    attrs={fields.attrVmps}
                    attribute={prop.attr}
                    unitLink={fields.unitState}
                    propDetails= {propDetails}
                    classifyState={classifyState}
                    responseState={responseState}>
                </AwClsAttributes>
            </div>}
        </div>
    );
};
