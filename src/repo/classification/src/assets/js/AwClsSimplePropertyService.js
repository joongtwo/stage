// Copyright (c) 2022 Siemens

/**
 * Defines {@link AwClsSimplePropertyService}
 *
 * @module js/AwClsSimplePropertyService
 */
import AwClsLOV from 'viewmodel/AwClsLOVViewModel';
import AwClsLOVInterdep from 'viewmodel/AwClsLOVInterdepViewModel';
import AwWidgetVal from 'viewmodel/AwWidgetValViewModel';
import eventBus from 'js/eventBus';
import classifyDefinesService from 'js/classifyDefinesService';

let exports = {};

/**
 * render function for AwClsSimpleProperty
 * @param {*} param0 context for render function interpolation
 * @returns {JSX.Element} react component
 */
export const awClsSimplePropertyServiceRenderFunction = (  props ) => {
    const { actions, ctxMin, classifyState, fields, propDetails, viewModel, attr, ...prop } = props;
    const { data, dataProviders } = viewModel;

    const selectedClass = classifyState.value.selectedClass;
    const panelMode = classifyState.value.panelMode;
    const updateMode = panelMode !== -1;

    const isMandatoryProperty = propDetails.isMandatory;
    const showMandatoryProperty = classifyState.selectedClass.showMandatory;

    if( !attr.required && isMandatoryProperty ) {
        attr.required = isMandatoryProperty;
    }

    const parentAttribute = propDetails.parentAttribute;
    const showAllProp = selectedClass.showAllProp === true || attr.fielddata.uiValue !== '';

    const hasLov = attr.fielddata.hasLov;
    const showLov =  hasLov && updateMode;

    attr.fielddata.propertyName = attr.name;

    attr.fielddata.displayValsModel =  attr.fielddata.displayValsModel ?? [];

    const propertyIsVisible = ( showAllProp || updateMode ) && !showMandatoryProperty || isMandatoryProperty && showMandatoryProperty;
    const cardinalProp = updateMode && parentAttribute.isCardinalControl === 'true';

    const isLocalizable = attr.fielddata.uwAnchor === classifyDefinesService.LOCALIZATION_ANCHOR;

    //The following class 'aw-clspanel-L10NPropertyValContainer' has no entry in any css
    //however it is need for cucumber test when locating this element. And may be used in future development.
    let className = isLocalizable && !updateMode ? 'aw-clspanel-L10NPropertyValContainer' : 'aw-clspanel-extendedPropCreate';
    if ( updateMode ) {
        className += ' aw-clspanel-update';
    }
    let instIndex = props.instIndex ? props.instIndex : -1;

    const onKeyPress = ( event ) => {
        if( event.key === 'Enter' ) {
            const test = 'Key Pressed';
            if ( cardinalProp ) {
                eventBus.publish( 'classify.generateInstances' );
            }
        }
    };

    const renderLovValue = ( ) => {
        if ( attr.fielddata.lovApi.isInterDependentKeyLOV ) {
            return (
                <AwClsLOVInterdep attr={attr} classifyState={classifyState}></AwClsLOVInterdep>
            );
        }
        return (
            <AwClsLOV
                attr={attr}
                instIndex={instIndex}
                propDetails= {props.propDetails}
                classifyState={classifyState}
                responseState={props.responseState}>
            </AwClsLOV>
        );
    };

    return (
        <div className={className}>
            {showLov && renderLovValue( ) }
            {!showLov &&
                <AwWidgetVal {...attr} onKeyDown={( event )=> onKeyPress( event )}></AwWidgetVal> }
        </div>
    );
};

export default exports = {
    awClsSimplePropertyServiceRenderFunction
};
