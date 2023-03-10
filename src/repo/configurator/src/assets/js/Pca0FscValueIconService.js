// Copyright (c) 2022 Siemens

/**
 * Helper service for Pca0FscValueIcon
 *
 * @module js/Pca0FscValueIconService
 */
import AwIcon from 'viewmodel/AwIconViewModel';
var exports = {};

/**
 * Rendering method
 *
 * @param {Object} props - props
 * @returns {Object} - Returns view
 */

export const pca0FscValueIconRenderFunction = ( props ) => {
    const getIcon = ( image ) => {
        switch ( image ) {
            case 'miscUiCheckboxUnselectedPressed':
                return <AwIcon iconId='miscUiCheckboxUnselectedPressed'></AwIcon>;
            case 'miscUiRadioSelected':
                return <AwIcon iconId='miscUiRadioSelected'></AwIcon>;
            case 'miscUiRadioUnselectedFocus':
                return <AwIcon iconId='miscUiRadioUnselectedFocus'></AwIcon>;
            case 'miscUiExcludeBox':
                return <AwIcon iconId='miscUiExcludeBox'></AwIcon>;
            case 'miscUiCheckboxSelected':
                return <AwIcon iconId='miscUiCheckboxSelected'></AwIcon>;

            default:
                return;
        }
    };
    return props && getIcon( props.value );
};


export default exports = {
    pca0FscValueIconRenderFunction
};

