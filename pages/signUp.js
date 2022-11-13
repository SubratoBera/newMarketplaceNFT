import React from "react";

//INTERNAL IMPORT
import Style from "../styles/login.module.css";
import LoginAndSignUp from "../loginAndSignUp/loginAndSignUp";

const signUp = () => {
  return (
    <div className={Style.login}>
      <div className={Style.login_box}>
        <h1>SignUp</h1>
        <LoginAndSignUp />
      </div>
    </div>
  );
};

export default signUp;