#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <direct.h>

int main() {
    char line[256];
    char serial[20];
    char folder[256];
    char command[512];
    char keyinfo[256];
    FILE *f;

    /* Change to local temp directory first */
    _chdir("C:\\WINDOWS\\TEMP");

    sprintf(keyinfo, "C:\\WINDOWS\\TEMP\\KEYINFO.TXT");

    /* Run KEYSHOW from local directory */
    sprintf(command, "C:\\Sova\\Bin\\KEYSHOW.EXE > \"%s\"", keyinfo);
    system(command);

    /* Check if file was created and has content */
    f = fopen(keyinfo, "r");
    if (f == NULL) {
        printf("ERROR: Could not create output file\n");
        printf("Tried to write to: %s\n", keyinfo);
        getchar();
        return 1;
    }

    /* Check file is not empty */
    fseek(f, 0, SEEK_END);
    long size = ftell(f);
    fseek(f, 0, SEEK_SET);
    if (size == 0) {
        fclose(f);
        printf("ERROR: KEYSHOW.EXE produced no output\n");
        getchar();
        return 1;
    }

    /* Search for serial number line */
    serial[0] = '\0';
    while (fgets(line, 256, f)) {
        char *pos = strstr(line, "serial number is");
        if (pos != NULL) {
            pos += 17;
            strncpy(serial, pos, 20);
            serial[strcspn(serial, "\r\n")] = 0;
            break;
        }
    }
    fclose(f);

    if (serial[0] == '\0') {
        printf("ERROR: Could not find serial number\n");
        printf("Contents of KEYINFO.TXT:\n");
        f = fopen(keyinfo, "r");
        if (f != NULL) {
            while (fgets(line, 256, f)) printf("%s", line);
            fclose(f);
        }
        getchar();
        return 1;
    }

    printf("Serial number found: %s\n", serial);

    /* Create network folders */
    _mkdir("\\\\BSI-Network\\surfscan-drop");
    sprintf(folder, "\\\\BSI-Network\\surfscan-drop\\%s", serial);

    if (_mkdir(folder) != 0) {
        printf("ERROR: Could not create folder %s\n", folder);
        getchar();
        return 1;
    }

    /* Copy KEYINFO.TXT to network folder */
    sprintf(command, "COPY \"%s\" \"%s\\KEYINFO.TXT\" > NUL", keyinfo, folder);
    system(command);

    /* Delete local temp file */
    remove(keyinfo);

    printf("Done! Saved to %s\n", serial);
    printf("Press Enter to exit\n");
    getchar();
    return 0;
}