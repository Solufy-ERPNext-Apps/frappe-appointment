import { useState } from "react";
import { useForm } from "react-hook-form";
import { motion } from "framer-motion";
import z from "zod";
import { useFrappePostCall } from "frappe-react-sdk";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarPlus, ChevronLeft, CircleAlert, X, ChevronDown } from "lucide-react";
import { formatDate } from "date-fns";
import { toast } from "sonner";
import { useSearchParams } from "react-router-dom";

/**
 * Internal dependencies.
 */
import { Button } from "@/components/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/form";
import { Input } from "@/components/input";
import Typography from "@/components/typography";
import { useAppContext } from "@/context/app";
import {
  getTimeZoneOffsetFromTimeZoneString,
  parseFrappeErrorMsg,
} from "@/lib/utils";
import Spinner from "@/components/spinner";

// Form schema using zod
const meetingFormSchema = z.object({
  chairperson: z.string().min(2, "Chairperson name must be at least 2 characters"),
  chairperson_id: z.string().optional(), // Optional chairperson_id
  host: z.string().email("Please enter a valid host email address"),
  participants: z.array(z.string().email("Please enter a valid email address")),
});

type MeetingFormValues = z.infer<typeof meetingFormSchema>;

interface MeetingFormProps {
  onBack: VoidFunction;
  onSuccess: (data: any) => void;
  durationId: string;
  isMobileView: boolean;
}

const MeetingForm = ({
  onBack,
  durationId,
  onSuccess,
  isMobileView,
}: MeetingFormProps) => {
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const [participantInput, setParticipantInput] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false); // For dropdown
  const [chairpersonId, setChairpersonId] = useState<string | null>(null); // Local state for chairperson_id
  const { call: bookMeeting, loading } = useFrappePostCall(
    `frappe_appointment.api.personal_meet.book_time_slot`
  );
  const [searchParams] = useSearchParams();

  const { selectedDate, selectedSlot, timeZone } = useAppContext();
  const userDocs: any[] = []; // Replace with actual user data source

  // Initialize form with react-hook-form
  const form = useForm<MeetingFormValues>({
    resolver: zodResolver(meetingFormSchema),
    defaultValues: {
      chairperson: "",
      chairperson_id: "", // Default value for chairperson_id
      host: "",
      participants: [],
    },
  });

  // Handle participant input field keydown event
  const handleParticipantKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addParticipant();
    }
  };

  // Add a participant to the form
  const addParticipant = () => {
    const email = participantInput.trim();
    if (email && email.includes("@")) {
      const currentParticipants = form.getValues("participants");
      if (!currentParticipants.includes(email)) {
        form.setValue("participants", [...currentParticipants, email]);
        setParticipantInput(""); // Clear input after adding
      }
    }
  };

  // Remove a participant from the form
  const removeParticipant = (email: string) => {
    const currentParticipants = form.getValues("participants");
    form.setValue(
      "participants",
      currentParticipants.filter((participant) => participant !== email)
    );
  };

  // Handle form submission
  const onSubmit = (data: MeetingFormValues) => {
    const extraArgs: Record<string, string> = {};
    searchParams.forEach((value, key) => (extraArgs[key] = value));
    const meetingData = {
      ...extraArgs,
      duration_id: durationId,
      date: new Intl.DateTimeFormat("en-CA", {
        year: "numeric",
        month: "numeric",
        day: "numeric",
      }).format(selectedDate),
      user_timezone_offset: String(getTimeZoneOffsetFromTimeZoneString(timeZone)),
      start_time: selectedSlot.start_time,
      end_time: selectedSlot.end_time,
      chairperson_name: data.chairperson,
      chairperson_id: chairpersonId, // Include chairperson_id from local state
      host_email: data.host,
      participants: data.participants.join(", "),
    };

    bookMeeting(meetingData)
      .then((data) => {
        onSuccess(data);
      })
      .catch((err) => {
        const error = parseFrappeErrorMsg(err);
        toast(error || "Something went wrong", {
          duration: 4000,
          classNames: {
            actionButton:
              "group-[.toast]:!bg-red-500 group-[.toast]:hover:!bg-red-300 group-[.toast]:!text-white",
          },
          icon: <CircleAlert className="h-5 w-5 text-red-500" />,
          action: {
            label: "OK",
            onClick: () => toast.dismiss(),
          },
        });
      });
  };

  // Handle selecting a chairperson from the dropdown
  const handleSelectChairperson = (user: any) => {
    form.setValue("chairperson", user.name);  // Set name as chairperson
    form.setValue("chairperson_id", user.id); // Set chairperson_id in the form
    setChairpersonId(user.id); // Store chairperson_id in the local state
    setIsDropdownOpen(false); // Close the dropdown
  };

  return (
    <motion.div
      key={2}
      className={`w-full md:h-[31rem] lg:w-[41rem] shrink-0 md:p-6 md:px-4`}
      initial={isMobileView ? {} : { x: "100%" }}
      animate={{ x: 0 }}
      exit={isMobileView ? {} : { x: "100%" }}
      transition={{ duration: 0.2, ease: "easeInOut" }}
    >
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-6 h-full flex justify-between flex-col"
        >
          <div className="space-y-4">
            <div className="flex gap-3 max-md:flex-col md:items-center md:justify-between">
              <Typography variant="p" className="text-2xl">
                Meeting Schedule
              </Typography>
              <Typography className="text-sm mt-1 text-blue-500 dark:text-blue-400">
                <CalendarPlus className="inline-block w-4 h-4 mr-1 md:hidden" />
                {formatDate(selectedDate, "d MMM, yyyy")}
              </Typography>
            </div>

            {/* Chairperson field */}
            <FormField
              control={form.control}
              name="chairperson"
              render={({ field }) => (
                <FormItem>
                  <FormLabel
                    className={`${
                      form.formState.errors.chairperson ? "text-red-500" : ""
                    }`}
                  >
                    Chairperson{" "}
                    <span className="text-red-500 dark:text-red-600">*</span>
                  </FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        disabled={loading}
                        className="active:ring-blue-400 focus-visible:ring-blue-400"
                        placeholder="Select or Add Chairperson"
                        {...field}
                      />
                      <Button
                        type="button"
                        className="absolute right-2 top-1/2 transform -translate-y-1/2"
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        disabled={loading}
                      >
                        <ChevronDown />
                      </Button>
                      {isDropdownOpen && (
                        <div className="absolute z-10 bg-white shadow-md border p-2 w-full mt-1">
                          <ul>
                            {Array.isArray(userDocs) && userDocs.length > 0 ? (
                              userDocs.map((user) => (
                                <li
                                  key={user.id} // Store the unique user ID
                                  onClick={() => handleSelectChairperson(user)}
                                  className="cursor-pointer p-1 hover:bg-blue-100"
                                >
                                  {user.name} {/* Display the name */}
                                </li>
                              ))
                            ) : (
                              <li className="cursor-not-allowed p-1 text-gray-500">No internal users available</li>
                            )}
                            <li
                              onClick={() => {
                                setIsDropdownOpen(false);
                              }}
                              className="cursor-pointer p-1 text-blue-500 hover:bg-blue-100"
                            >
                              Add New Chairperson
                            </li>
                          </ul>
                        </div>
                      )}
                    </div>
                  </FormControl>
                  <FormMessage
                    className={`${
                      form.formState.errors.chairperson ? "text-red-500" : ""
                    }`}
                  />
                </FormItem>
              )}
            />

            {/* Host field */}
            <FormField
              control={form.control}
              name="host"
              render={({ field }) => (
                <FormItem>
                  <FormLabel
                    className={`${
                      form.formState.errors.host ? "text-red-500" : ""
                    }`}
                  >
                    Host{" "}
                    <span className="text-red-500 dark:text-red-600">*</span>
                  </FormLabel>
                  <FormControl>
                    <Input
                      disabled={loading}
                      className={`active:ring-blue-400 focus-visible:ring-blue-400 ${
                        form.formState.errors.host
                          ? "active:ring-red-500 focus-visible:ring-red-500"
                          : ""
                      }`}
                      placeholder="host@example.com"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage
                    className={`${
                      form.formState.errors.host ? "text-red-500" : ""
                    }`}
                  />
                </FormItem>
              )}
            />

            {/* Participants field */}
            <div className="space-y-2">
              <Button
                type="button"
                variant="ghost"
                className="h-auto hover:bg-blue-50 dark:hover:bg-blue-800/10 text-blue-500 dark:text-blue-400 hover:text-blue-600"
                onClick={() => setIsParticipantsOpen(!isParticipantsOpen)}
                disabled={loading}
              >
                {isParticipantsOpen ? "Hide Participants" : "+ Add Participants"}
              </Button>

              {isParticipantsOpen && (
                <div className="space-y-2">
                  <div className="relative">
                    <Input
                      placeholder="janedoe@hotmail.com, bob@gmail.com, etc."
                      value={participantInput}
                      className="active:ring-blue-400 focus-visible:ring-blue-400"
                      onChange={(e) => setParticipantInput(e.target.value)}
                      onKeyDown={handleParticipantKeyDown}
                      onBlur={addParticipant}
                      disabled={loading}
                    />
                    <Button
                      type="button"
                      className="absolute right-2 top-1/2 transform -translate-y-1/2"
                      onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                      disabled={loading}
                    >
                      <ChevronDown />
                    </Button>
                    {isDropdownOpen && (
                      <div className="absolute z-10 bg-white shadow-md border p-2 w-full mt-1">
                        <ul>
                          {userDocs?.map((user) => (
                            <li
                              key={user.id} // Correct unique identifier for participants
                              onClick={() => {
                                form.setValue("participants", [
                                  ...form.getValues("participants"),
                                  user.email, // Store the email of the participant
                                ]);
                              }}
                              className="cursor-pointer p-1 hover:bg-blue-100"
                            >
                              {user.name} {/* Display participant name */}
                            </li>
                          ))}
                          <li
                            onClick={() => {
                              setIsDropdownOpen(false);
                              addParticipant();
                            }}
                            className="cursor-pointer p-1 text-blue-500 hover:bg-blue-100"
                          >
                            Add New Participant
                          </li>
                        </ul>
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {form.watch("participants").map((participant) => (
                      <div
                        key={participant}
                        className="flex items-center gap-1 px-2 py-1 bg-blue-500 dark:bg-blue-400 text-white dark:text-background rounded-full text-sm"
                      >
                        <span>{participant}</span>
                        <button
                          type="button"
                          onClick={() => removeParticipant(participant)}
                          className="hover:text-blue-200"
                        >
                          <X className="h-3 w-3 dark:text-background" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-between md:pt-4 max-md:h-14 max-md:fixed max-md:bottom-0 max-md:left-0 max-md:w-screen max-md:border max-md:z-10 max-md:bg-background max-md:border-top max-md:items-center max-md:px-4">
            <Button
              type="button"
              className="text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-400 md:hover:bg-blue-50 md:dark:hover:bg-blue-800/10 max-md:px-0 max-md:hover:underline max-md:hover:bg-transparent"
              onClick={onBack}
              variant="ghost"
              disabled={loading}
            >
              <ChevronLeft /> Back
            </Button>
            <Button
              disabled={loading}
              className="bg-blue-500 dark:bg-blue-400 hover:bg-blue-500 dark:hover:bg-blue-400"
              type="submit"
            >
              {loading && <Spinner />} Schedule Meeting
            </Button>
          </div>
        </form>
      </Form>
    </motion.div>
  );
};

export default MeetingForm;