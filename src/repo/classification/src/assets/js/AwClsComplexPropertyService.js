// Copyright (c) 2022 Siemens

/**
 * Defines {@link AwClsComplexPropertyService}
 *
 * @module js/AwClsComplexPropertyService
 */
import AwPropertyVal from 'viewmodel/AwPropertyValViewModel';

let exports = {};

/**
 * render function for AwClsComplexProperty
 * @param {*} props props
 * @returns {JSX.Element} react component
 */
export const awClsComplexPropServiceRenderFunction = ( props ) => {
    const {  fields, classifyState, attrs, formatType, ...prop } = props;

    let attr = attrs[0];

    const renderProp = ( attr, classProp ) => {
        return (
            <AwPropertyVal {...attr } className={classProp}></AwPropertyVal>
        );
    };

    const renderPosition = () => {
        return (
            <div className='sw-row aw-clspanel-complex'>
                { renderProp( attrs[0], 'aw-complex-x' ) }
                { renderProp( attrs[3], 'aw-complex-y' ) }
                { renderProp( attrs[4], 'aw-complex-z' ) }
            </div>
        );
    };

    const renderRotationAxis = () => {
        return (
            <div className='sw-row aw-clspanel-complex'>
                { renderProp( attrs[5], 'aw-complex-rx' ) }
                { renderProp( attrs[6], 'aw-complex-ry' ) }
                { renderProp( attrs[7], 'aw-complex-rz' ) }
            </div>
        );
    };

    const renderAxis = () => {
        return (
            <div className='aw-clspanel-complex-axis'>
                { renderPosition() }
                <div></div>
                { renderRotationAxis() }
            </div>
        );
    };

    const renderRange = () => {
        return (
            <div className='sw-row aw-clspanel-complex'>
                { renderProp( attrs[0], 'aw-complex-min' ) }
                { renderProp( attrs[3], 'aw-complex-max' ) }
            </div>
        );
    };

    const renderTolerance = () => {
        return (
            <div className='sw-row aw-clspanel-complex'>
                { renderProp( attrs[0], 'aw-complex-nom' ) }
                { renderProp( attrs[3], 'aw-complex-min' ) }
                { renderProp( attrs[4], 'aw-complex-max' ) }
            </div>
        );
    };

    const renderLevel = () => {
        return (
            <div className='sw-row aw-clspanel-complex'>
                { renderProp( attrs[0], 'aw-complex-nom' ) }
                { renderProp( attrs[3], 'aw-complex-typ' ) }
                { renderProp( attrs[4], 'aw-complex-min' ) }
                { renderProp( attrs[5], 'aw-complex-max' ) }
            </div>
        );
    };

    return (
        <div className='flex-shrink'>
            {/* Value Range */}
            { formatType === 5 &&  renderRange() }
            {/* Value Tolerance */}
            { formatType === 6 && renderTolerance() }
            {/* Level */}
            { formatType === 7 && renderLevel() }
            {/* Position */}
            { formatType === 8 &&  renderPosition() }
            {/* <!-- Axis --> */}
            { formatType === 9 && renderAxis() }
        </div>
    );
};

export default exports = {
    awClsComplexPropServiceRenderFunction
};
