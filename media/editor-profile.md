# Pharo editor profile

The **Pharo** profile is a separate VS Code profile dedicated to your Pharo image:

- **Primary sidebar**: the *Pharo* view (Images, Projects, Editor Stack, Variables).
- **Secondary sidebar**: the class panel.
- **Bottom panel**: the inspector, and the Output view with the Pharo Transcript.
- **Hidden**: Explorer, Search, Source Control, Run and Debug, Extensions… They stay available from the Command Palette.

Your Pharo settings (image, VM, …) are copied into the profile, which only contains the Pharo extensions.

VS Code does not let extensions create profiles: the command writes a profile file, copies its path to the clipboard and opens the Profiles editor. There, open the menu next to **New Profile**, choose **Import Profile...** and paste the path.

Run **Pharo: Set Up Pharo Editor Profile** again from the Pharo profile to restore the layout after moving views around.
