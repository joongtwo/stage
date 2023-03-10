// Copyright (c) 2022 Siemens

/**
 * Helper service for Pca0FamilyService
 *
 * @module js/Pca0FamilyService
 */
import Pca0FscValue from 'viewmodel/Pca0FscValueViewModel';
import AwCommandPanelSection from 'viewmodel/AwCommandPanelSectionViewModel';
import appCtxSvc from 'js/appCtxService';
import _ from 'lodash';
var exports = {};

/**
 * Rendering method
 *
 * @param {Object} props - props
 * @returns {Object} - Returns view
 */
export const pca0FamilyRenderFunction = ( props ) => {
    let { family, famIndex, i18n } = props;
    let fscContext = appCtxSvc.getCtx( 'fscContext' );

    const getShowEnumeratedRange = () => {
        return !appCtxSvc.getCtx( props.variantcontext ).guidedMode;
    };
    const getFeatureKey = ( value, index ) => {
        return value.optValueStr + index;
    };

    const fetchEachValue = ( value, family, configuid, famIndex, index ) => {
        return (
            <Pca0FscValue  valueaction='selectFeature' key={getFeatureKey( value, index )}
                famIndex={famIndex} index={index} variantcontext='fscContext'
                family={family}  value={value}
                configuid={configuid} ></Pca0FscValue>
        );
    };

    const classes = 'aw-clspanel-propSection ' +
        ( family.isHighlighted ? 'aw-cfg-familyHighlightedForCompletenessCheck' : '' );

    return (
        <div id={'pca0FeaturesFamilies_' + family.familyStr }  key={family.familyStr} >
            <AwCommandPanelSection alignment='HORIZONTAL' className={classes} id='aw-clspanel-propSection'
                caption={family.familyDisplayName} collapsed={family.isCollapsed} anchor='aw_cfgFamilyCommandBar'
                context={{ family:family, famIndex: famIndex, showEnumeratedRange:  getShowEnumeratedRange(), configPerspectiveUid:props.configuid  }}
                title={family.familyDisplayName} key={famIndex}>
                { family.singleSelect && !fscContext.guidedMode  && <div><span>{i18n.aw_single_select_message}</span></div> }
                { family.allowedRange && !fscContext.guidedMode && <div className='aw-cfg-rangeInfo'>
                    <span className='aw-widgets-propertyLabel'>{i18n.allowedRange} </span>
                    <span>{family.allowedRange}</span>
                </div> }
                { family.allowedRange && fscContext.guidedMode && <div className='aw-cfg-rangeInfo'>
                    <span className='aw-widgets-propertyLabel'> {i18n.allowedRange} </span>
                    <span>{family.allowedRange}</span>
                </div> }

                {  props.family.values &&  props.family.values.length > 0 &&
                     props.family.values.map( ( value, index ) => fetchEachValue( value, props.family, props.configuid, props.famIndex, index ) )
                }
            </AwCommandPanelSection>
        </div>

    );
};

export default exports = {
    pca0FamilyRenderFunction
};
