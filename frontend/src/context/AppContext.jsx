import { createContext , useContext, useState } from "react";


const AppContext = createContext(null);

export function AppProvider ({ children }){
const [state, setState] = useState({});

return(
<AppContext.Provider value={{state, setState}}>
    {children}
</AppContext.Provider>

);

}

export function useAppContext(){
    return useContext(AppContext)
}