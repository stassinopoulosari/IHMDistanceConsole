(() => {
  // Log In Event

  var auth = firebase.auth(),
    $submitButton = document.getElementById("dd-login-submit"),
    $resetPasswordButton = document.getElementById("dd-login-reset-password"),
    $email = document.getElementById("dd-login-email"),
    $password = document.getElementById("dd-login-password"),
    $errorMessage = document.getElementById("dd-login-errorMessage");

  $errorMessage.style.display = "none";

  var resetErrorMessageStyle = () => {
    $errorMessage.classList.remove("alert-success");
    $errorMessage.classList.add("alert-danger");
    $errorMessage.style.display = "none";
  };

  var resetPassword = $resetPasswordButton.onclick = () => {
    resetErrorMessageStyle();
    var email = $email.value;
    if(email.trim() == "") {
      $errorMessage.innerText = "Please enter your email in order to reset your password.";
      $errorMessage.style.display = "block";
      return;
    }

    auth.sendPasswordResetEmail(email, {
      url:"https://ihmdc.ari-s.com/",
      handleCodeInApp: false
    }).then(() => {
      $errorMessage.innerText = "Assuming you have an account, I've sent you a password reset link. Please do be patient and check your spam folder for it.";
      $errorMessage.classList.remove("alert-danger");
      $errorMessage.classList.add("alert-success");
      $errorMessage.style.display = "block";
    }).catch(() => {
      $errorMessage.innerText = "Sorry, the password reset failed. Please talk to Ari to sort this out using the big red button at the bottom of the page.";
      $errorMessage.style.display = "block";
      return;
    });
  }

  var tryLogin = $submitButton.onclick = () => {

    resetErrorMessageStyle();

    $submitButton.disabled = true;

    var email = $email.value,
      password = $password.value,
      loginError = null;
    auth.signInWithEmailAndPassword(email, password)
      .catch((error) => {
        loginError = error;
        $submitButton.disabled = false;
        var errorMessage = (loginError.message || "The login failed, sorry.");
        $errorMessage.innerText = errorMessage;
        $errorMessage.style.display = "block";
      })
      .then(() => {
        if (loginError != null) return;
        location.assign("./console");
      });

      return true;
  };

  $email.onkeydown = $password.onkeydown = (e) => {
    if(e.key == "Enter") tryLogin() && e.preventDefault();
  };

})();
