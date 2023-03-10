// Copyright 2018 Siemens Product Lifecycle Management Software Inc.

/*global
 define
 */

/**
 * Defines {@link AwClsPropertyLabelService}
 *
 * @module js/AwClsPropertyLabelService
 */
import _ from 'lodash';

import AwPropertyLabel from 'viewmodel/AwPropertyLabelViewModel';
import { ExtendedTooltip } from 'js/hocCollection';

const AwPropertyLabelHOC = ExtendedTooltip( AwPropertyLabel );
let exports = {};

/**
 * render function for AwClsPropertyLabel
 * @param {*} param0 context for render function interpolation
 * @returns {JSX.Element} react component
 */
export const AwClsPropertyLabelServiceRenderFunction = (  props ) => {
    const { classifyState, attr, anno, viewModel,  ...prop } = props;
    const { data } = viewModel;

    const selectedClass = classifyState.value.selectedClass;
    const showAnno = selectedClass.showAnno;
    const hasAnno = selectedClass.hasAnno;
    const panelMode = classifyState.value.panelMode;
    const isBool = attr && attr.typex === 'BOOLEAN';

    const labelStyle = !isBool ||  isBool && panelMode === -1;
    const labelProps = attr.fielddata ? attr.fielddata.labelProps : null;
    const hasLabelProps = labelProps && labelProps.length !== 0;
    let context = {
        labelProps: labelProps,
        adjustTooltip: classifyState.value.classifyFullscreen && !classifyState.value.showTabTree
    };

    return (
        <div className={ ( labelStyle ? 'aw-clspanel-propertyLabelAnno' : 'aw-clspanel-extendedPropBool' ) }>
            <div className='aw-clspanel-propertyLabelField'>
                {!hasLabelProps && <AwPropertyLabel className='w-12' {...attr}>
                </AwPropertyLabel>}
                {hasLabelProps && <AwPropertyLabelHOC className='w-12' {...attr}
                    extendedTooltipOptions="{alignment : 'top'}"
                    extendedTooltip='data.showLabelTooltip'
                    extTooltipData={data}
                    extendedTooltipContext={context}>
                </AwPropertyLabelHOC>}
            </div>
            { hasAnno  && showAnno && <AwPropertyLabel className='aw-clspanel-propertyAnnotationLabel w-3' {...anno} >
            </AwPropertyLabel>}
        </div>
    );
};

export default exports = {
    AwClsPropertyLabelServiceRenderFunction
};
