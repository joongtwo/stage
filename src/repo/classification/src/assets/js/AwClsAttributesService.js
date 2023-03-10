// Copyright (c) 2022 Siemens

/**
 * Defines {@link AwClsAttributesService}
 *
 * @module js/AwClsAttributesService
 */
import _ from 'lodash';
import AwCheckbox from 'viewmodel/AwCheckboxViewModel';
import AwClsList from 'viewmodel/AwClsListViewModel';
import AwClsPropertyLabel from 'viewmodel/AwClsPropertyLabelViewModel';
import AwClsComplexProperty from 'viewmodel/AwClsComplexPropertyViewModel';
import AwClsSimpleProperty from 'viewmodel/AwClsSimplePropertyViewModel';
import AwIcon from 'viewmodel/AwIconViewModel';
import AwIconButton from 'viewmodel/AwIconButtonViewModel';
import AwPropertyLabel from 'viewmodel/AwPropertyLabelViewModel';
import { ExtendedTooltip } from 'js/hocCollection';
import classifyUtils from 'js/classifyUtils';
import classifySvc from 'js/classifyService';
import uwPropertyService from 'js/uwPropertyService';
import classifyAdminConstants from 'js/classifyAdminConstants';
export let ATTRIBUTE_ID_SUBSTRING = 'cst0';
export let ATTRIBUTE_ID = 'IRDI';

const AwIconHOC = ExtendedTooltip( AwIcon );

export const updateInstances = ( cardinalAttribute, classifyState ) => {
    const tmpState = { ...classifyState.value };

    const size = cardinalAttribute.instances.length;
    cardinalAttribute.hasBlockChildren = size > 0;
    tmpState.selectedCardinalAttribute = cardinalAttribute;
    tmpState.updateInstances = cardinalAttribute.id + size;
    classifyState.update( tmpState );
};

/*
 * Updates the attribute on change of attribute's unit
 *
 * @param {Object} classifyState - classifyState
 * @param {Object} attribute - attribute
 * @param {Object} unitLink - unitLink
 */
export const updateUnitValue = ( classifyState, attribute, unitLink ) => {
    if( attribute.vmps[2].uiValue !== unitLink.value.uiValue ) {
        if ( attribute.updatedUnits && !unitLink.value.valueUpdated ) {
            unitLink.value.uiValue = attribute.vmps[2].uiValue;
        } else  {
            const tmpState = { ...classifyState.value };
            attribute.vmps[2] = unitLink.value;
            attribute.updatedUnits = false;
            tmpState.attrs = classifyUtils.updateAttrsList(  classifyState.attrs, attribute );
            classifyState.update( tmpState );
            unitLink.value.valueUpdated = false;
        }
    }
};

/**
 * following method assign the attribute properties of selected property to subpanelcontext's searchState
 * it is called when clicked on any property in Application class tab at nodes sublocation (cls manager)
 * @param {Object} selectedProp selected property in properties section
 * @param {Object} searchState subPanelContext's searchState
 */
export const getAttributeProperties = function( selectedProp, searchState ) {
    const tmpState = { ...searchState.value };
    tmpState.appClassData.attributesVisible = true;
    tmpState.appClassData.propAttr = [];

    var attrId = selectedProp.origAttributeInfo.attributeId;
    if( attrId.substring( 0, 4 ) === classifyAdminConstants.NODE_APP_CLASS_ATTRIBUTE_ID_SUBSTRING ) {
        attrId = attrId.substring( 4, attrId.length );
    }
    var vmoProp1 = uwPropertyService.createViewModelProperty( classifyAdminConstants.NODE_APP_CLASS_ATTRIBUTE_ID, classifyAdminConstants.NODE_APP_CLASS_ATTRIBUTE_ID, '', attrId.toString(), attrId.toString() );
    vmoProp1.uiValue = attrId.toString();
    tmpState.appClassData.propAttr.push( vmoProp1 );

    let tmpProperties = selectedProp.origAttributeInfo.attributeProperties;

    _.forEach( classifySvc.UNCT_ATTR_PROP, function( key, index ) {
        var value = classifySvc.getPropertyValue(
            tmpProperties, key );
        key = classifySvc.UNCT_ATTR_PROP_DISP[ index ];
        var vmoProp = uwPropertyService.createViewModelProperty( key, key, '', value.toString(), value.toString() );
        vmoProp.uiValue = value.toString();
        tmpState.appClassData.propAttr.push( vmoProp );
    } );
    searchState.update( tmpState );
};

/**
  * render function for AwClsAttributes
  * @param {*} param0 context for render function interpolation
  * @returns {JSX.Element} react component
  */
// eslint-disable-next-line complexity
export const AwClsAttributesServiceRenderFunction = (  props ) => {
    const { actions, attrs, attribute, ctxMin, classifyState,  fields, propDetails, viewModel, responseState, ...prop } = props;
    const unitLink = prop.unitLink;
    const { cardinalCommand } = fields;
    const { data, dataProviders } = viewModel;

    const isAdmin = classifyState.value.isAdmin;

    const selectedClass = classifyState.value.selectedClass;
    const showAnno = selectedClass.showAnno;
    const hasAnno = selectedClass.hasAnno;
    const panelMode = classifyState.value.panelMode;
    const updateMode = panelMode !== -1;

    const isMandatoryProperty = propDetails.isMandatory;
    const showMandatoryProperty = classifyState.selectedClass.showMandatory;
    let attr = attrs[0];
    let anno = attrs[1];
    let unit = attrs[2];
    if( !attr.required && isMandatoryProperty ) {
        attr.required = isMandatoryProperty;
    }

    const parentAttribute = propDetails.parentAttribute;
    const showMinmaxMsg = propDetails.showMinmaxMsg;
    const labelProps = propDetails.labelProps;

    const hasLabelProps = labelProps && labelProps !== '';
    if ( hasLabelProps ) {
        attr.fielddata.labelProps = labelProps;
    }

    const showAllProp = selectedClass.showAllProp === true || attr.fielddata.uiValue !== '';

    const isBool = attr && attr.typex === 'BOOLEAN';
    const boolViewMode = isBool && !updateMode;
    var boolValue = attr.value;
    boolValue = boolValue === undefined ? false : boolValue;

    const labelStyle = !isBool ||  isBool && panelMode === -1;
    const toggleMetric = classifyState.value.currentUnitSystem ? classifyState.value.currentUnitSystem.dbValue : undefined;
    const newUnit = classifyState.value.updateMetric ? attribute.unitSystem.unitName : unitLink.propertyName;

    const hasUnits = unitLink && unitLink.value && unitLink.value.propertyDisplayName && unitLink.value.propertyDisplayName !== '';
    const hasMinMax = showMinmaxMsg && showMinmaxMsg !== '';

    const cardinalProp = updateMode && parentAttribute.isCardinalControl === 'true';
    const complex = attrs.length > 3;
    const nonBool = !isBool || !updateMode;

    const propertyIsVisible = ( showAllProp || updateMode ) && !showMandatoryProperty || isMandatoryProperty && showMandatoryProperty;
    let formatType = attribute.unitSystem.formatDefinition.formatType;

    const renderBoolAttribute = ( ) => {
        return (
            <div>
                <AwCheckbox className='aw-clspanel-extendedPropBool' {...attr}/>
                {hasAnno  && showAnno  && <AwPropertyLabel className='aw-clspanel-propertyAnnotationLabelBool' {...anno} >
                </AwPropertyLabel>}
            </div>
        );
    };

    const renderAttribute = () => {
        return (
            <div className='aw-clspanel-propertyContainer'>
                { ( !isBool || !updateMode ) && <AwClsPropertyLabel
                    attr={attr} anno={anno}
                    classifyState={classifyState}>
                </AwClsPropertyLabel>}

                { nonBool && !complex &&
                     <AwClsSimpleProperty
                         attr={attr}
                         instIndex={attribute.instIndex}
                         propDetails= {propDetails}
                         classifyState={classifyState}
                         responseState={responseState}>
                     </AwClsSimpleProperty> }
                { nonBool && complex &&
                     <AwClsComplexProperty
                         attrs={attrs}
                         formatType={formatType}
                         classifyState={classifyState}>
                     </AwClsComplexProperty> }


                { isBool && updateMode && renderBoolAttribute( ) }

                { hasUnits && <AwClsList attr={attr}
                    unitLink={unitLink}
                    parentAttribute={parentAttribute}
                    toggleMetric={toggleMetric}
                    updateMetric={classifyState.value.updateMetric}
                    updatedUnit={newUnit}
                    updateMode={updateMode}>
                </AwClsList> }

                { cardinalProp && <AwIconButton command={cardinalCommand}></AwIconButton> }

                {updateMode && hasMinMax &&
                    // add tabindex for wcag
                    // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
                    <div tabIndex={0} className='aw-clspanel-showMinMax'>
                        <AwIconHOC iconId='homeHelp'
                            extendedTooltipOptions="{alignment : 'top'}"
                            extendedTooltip='data.showMinMaxTooltip'
                            extTooltipData={data}
                            extendedTooltipContext={showMinmaxMsg}>
                        </AwIconHOC>
                    </div>}
            </div>
        );
    };

    const renderAdminAttribute = () => {
        return(
            // eslint-disable-next-line jsx-a11y/click-events-have-key-events
            <div className='sw-row aw-clsadmin-propertyContainer'
                onClick={actions.onClickProp}
                role='button'
                tabIndex={0}>
                { <AwClsPropertyLabel
                    attr={attr}
                    classifyState={classifyState}>
                </AwClsPropertyLabel>}

                { hasUnits && attr && <AwClsList attr={attr}
                    unitLink={unitLink}>
                </AwClsList> }
            </div>
        );
    };

    return (
        <div className='aw-clspanel-pair'>
            { propertyIsVisible && !isAdmin && renderAttribute() }
            { isAdmin && renderAdminAttribute()}
        </div>
    );
};
